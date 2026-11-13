import os
import sys
import time
import shutil
import argparse
import requests
from typing import Dict, Any, List, Optional, Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from huggingface_hub import HfFolder, hf_hub_download, hf_hub_url

MODEL_REGISTRY = {
    "small-sfx": {
        "repo_id": "stabilityai/stable-audio-3-small-sfx",
        "description": "Sound effects, foley, and ambient audio generation",
        "files": [
            {"filename": "model_config.json", "is_large": False},
            {"filename": "model.safetensors", "is_large": True, "expected_min_mb": 2000},
        ],
    },
    "small-music": {
        "repo_id": "stabilityai/stable-audio-3-small-music",
        "description": "Melodic score beds, instruments, and music generation (8-step post-trained)",
        "files": [
            {"filename": "model_config.json", "is_large": False},
            {"filename": "model.safetensors", "is_large": True, "expected_min_mb": 2000},
        ],
    },
    "small-music-base": {
        "repo_id": "stabilityai/stable-audio-3-small-music-base",
        "description": "Foundational music base model checkpoint (research/fine-tuning)",
        "files": [
            {"filename": "model_config.json", "is_large": False},
            {"filename": "model.safetensors", "is_large": True, "expected_min_mb": 2000},
        ],
    },
}

T5GEMMA_FILES = [
    {"filename": "t5gemma-b-b-ul2/config.json", "is_large": False},
    {"filename": "t5gemma-b-b-ul2/special_tokens_map.json", "is_large": False},
    {"filename": "t5gemma-b-b-ul2/tokenizer.json", "is_large": False},
    {"filename": "t5gemma-b-b-ul2/tokenizer.model", "is_large": False},
    {"filename": "t5gemma-b-b-ul2/tokenizer_config.json", "is_large": False},
    {"filename": "t5gemma-b-b-ul2/model.safetensors", "is_large": True, "expected_min_mb": 1000},
]

class ModelDownloader:
    def __init__(self, token: Optional[str] = None, num_workers: int = 8):
        self.token = token or os.environ.get("HF_TOKEN") or HfFolder.get_token()
        self.num_workers = num_workers
        self.current_download_state: Dict[str, Any] = {
            "is_downloading": False,
            "active_model": None,
            "file": None,
            "progress_pct": 0.0,
            "speed_mb_s": 0.0,
            "downloaded_mb": 0.0,
            "total_mb": 0.0,
            "error": None,
        }

    def get_token(self) -> str:
        if not self.token:
            self.token = os.environ.get("HF_TOKEN") or HfFolder.get_token()
        if not self.token:
            raise RuntimeError(
                "No Hugging Face token found. Please set the HF_TOKEN environment variable "
                "or run 'huggingface-cli login' with an authorized Hugging Face account."
            )
        return self.token

    def _get_snapshot_dir(self, repo_id: str) -> str:
        token = self.get_token()
        cfg_path = hf_hub_download(repo_id=repo_id, filename="model_config.json", token=token)
        return os.path.dirname(cfg_path)

    def _find_existing_t5gemma_dir(self) -> Optional[str]:
        """Checks across all registered model cache directories for an already downloaded t5gemma-b-b-ul2."""
        for m in MODEL_REGISTRY.values():
            repo_id = m["repo_id"]
            try:
                hub_root = os.path.dirname(os.path.dirname(os.path.dirname(self._get_snapshot_dir(repo_id))))
            except Exception:
                hub_root = os.path.expanduser("~/.cache/huggingface/hub")

            repo_cache_dir = os.path.join(hub_root, f"models--{repo_id.replace('/', '--')}")
            snapshots_dir = os.path.join(repo_cache_dir, "snapshots")
            if not os.path.exists(snapshots_dir):
                continue
            for snap in os.listdir(snapshots_dir):
                candidate_t5 = os.path.join(snapshots_dir, snap, "t5gemma-b-b-ul2")
                safetensors = os.path.join(candidate_t5, "model.safetensors")
                if os.path.exists(safetensors) and (os.path.getsize(safetensors) / (1024 * 1024)) >= 1000:
                    return candidate_t5
        return None

    def _sync_t5gemma_from_existing(self, target_t5_dir: str) -> bool:
        """Shares or links an existing t5gemma-b-b-ul2 directory into target snapshot, saving ~1.18 GB download."""
        src_dir = self._find_existing_t5gemma_dir()
        if not src_dir or os.path.abspath(src_dir) == os.path.abspath(target_t5_dir):
            return False

        print(f"[Downloader] Found existing shared T5Gemma at: {src_dir}")
        print(f"[Downloader] Linking/copying into: {target_t5_dir}...")
        os.makedirs(target_t5_dir, exist_ok=True)

        for fname in os.listdir(src_dir):
            src_file = os.path.join(src_dir, fname)
            dst_file = os.path.join(target_t5_dir, fname)
            if not os.path.exists(dst_file):
                try:
                    # Attempt hardlink first for zero extra disk usage
                    os.link(src_file, dst_file)
                except Exception:
                    # Fallback to copy
                    shutil.copy2(src_file, dst_file)
        return True

    def check_file_installed(self, repo_id: str, filename: str, expected_min_mb: Optional[float] = None) -> bool:
        try:
            snapshot_dir = self._get_snapshot_dir(repo_id)
            target_path = os.path.join(snapshot_dir, filename.replace("/", os.sep))
            if not os.path.exists(target_path):
                return False
            size_mb = os.path.getsize(target_path) / (1024 * 1024)
            if expected_min_mb and size_mb < expected_min_mb:
                return False
            return True
        except Exception:
            return False

    def check_model_status(self, model_name: str) -> Dict[str, Any]:
        if model_name not in MODEL_REGISTRY:
            raise ValueError(f"Unknown model: '{model_name}'. Available: {list(MODEL_REGISTRY.keys())}")

        cfg = MODEL_REGISTRY[model_name]
        repo_id = cfg["repo_id"]
        missing_files = []
        installed_bytes = 0

        # Check model files
        for f in cfg["files"]:
            min_mb = f.get("expected_min_mb")
            fname = f["filename"]
            if not self.check_file_installed(repo_id, fname, min_mb):
                missing_files.append(fname)
            else:
                snapshot_dir = self._get_snapshot_dir(repo_id)
                target = os.path.join(snapshot_dir, fname.replace("/", os.sep))
                installed_bytes += os.path.getsize(target)

        # Check shared T5Gemma files
        t5_missing = []
        for f in T5GEMMA_FILES:
            fname = f["filename"]
            min_mb = f.get("expected_min_mb")
            if not self.check_file_installed(repo_id, fname, min_mb):
                t5_missing.append(fname)
            else:
                snapshot_dir = self._get_snapshot_dir(repo_id)
                target = os.path.join(snapshot_dir, fname.replace("/", os.sep))
                installed_bytes += os.path.getsize(target)

        all_missing = missing_files + t5_missing
        is_installed = len(all_missing) == 0

        return {
            "model_name": model_name,
            "repo_id": repo_id,
            "description": cfg["description"],
            "is_installed": is_installed,
            "installed_size_mb": round(installed_bytes / (1024 * 1024), 2),
            "missing_files": all_missing,
        }

    def list_all_models_status(self) -> List[Dict[str, Any]]:
        return [self.check_model_status(m) for m in MODEL_REGISTRY.keys()]

    def _fast_download_file(
        self,
        repo_id: str,
        filename: str,
        target_path: str,
        progress_cb: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> str:
        token = self.get_token()
        url = hf_hub_url(repo_id=repo_id, filename=filename)
        headers = {"authorization": f"Bearer {token}"}

        head = requests.head(url, headers=headers, allow_redirects=True)
        if head.status_code != 200:
            raise RuntimeError(f"Failed to query {url}: HTTP {head.status_code}")

        total_size = int(head.headers.get("content-length", 0))
        direct_url = head.url

        if os.path.exists(target_path) and os.path.getsize(target_path) == total_size:
            print(f"File already verified complete: {target_path}")
            return target_path

        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        part_size = total_size // self.num_workers

        with open(target_path, "wb") as f:
            f.seek(total_size - 1)
            f.write(b"\0")

        def download_chunk(idx, start_byte, end_byte):
            rng_hdr = {"Range": f"bytes={start_byte}-{end_byte}"}
            r = requests.get(direct_url, headers=rng_hdr, stream=True)
            if r.status_code not in (200, 206):
                r = requests.get(
                    url,
                    headers={"authorization": f"Bearer {token}", "Range": f"bytes={start_byte}-{end_byte}"},
                    stream=True,
                )
            with open(target_path, "r+b") as out_f:
                out_f.seek(start_byte)
                written = 0
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        out_f.write(chunk)
                        written += len(chunk)
            return idx, written

        ranges = []
        for i in range(self.num_workers):
            start = i * part_size
            end = total_size - 1 if i == self.num_workers - 1 else (i + 1) * part_size - 1
            ranges.append((i, start, end))

        t0 = time.time()
        downloaded_total = 0

        with ThreadPoolExecutor(max_workers=self.num_workers) as executor:
            futures = [executor.submit(download_chunk, *r) for r in ranges]
            for f in as_completed(futures):
                idx, bytes_done = f.result()
                downloaded_total += bytes_done
                elapsed = time.time() - t0
                speed = (downloaded_total / (1024 * 1024)) / elapsed if elapsed > 0 else 0
                pct = round((downloaded_total / total_size) * 100, 1)

                state = {
                    "file": filename,
                    "downloaded_mb": round(downloaded_total / (1024 * 1024), 2),
                    "total_mb": round(total_size / (1024 * 1024), 2),
                    "progress_pct": pct,
                    "speed_mb_s": round(speed, 2),
                }
                self.current_download_state.update(state)
                if progress_cb:
                    progress_cb(state)
                print(f"[{filename}] Chunk {idx+1}/{self.num_workers} done | {pct}% ({speed:.2f} MB/s)")

        return target_path

    def download_model(
        self,
        model_name: str,
        progress_cb: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> bool:
        if model_name not in MODEL_REGISTRY:
            raise ValueError(f"Unknown model: '{model_name}'. Available: {list(MODEL_REGISTRY.keys())}")

        cfg = MODEL_REGISTRY[model_name]
        repo_id = cfg["repo_id"]
        token = self.get_token()

        self.current_download_state["is_downloading"] = True
        self.current_download_state["active_model"] = model_name
        self.current_download_state["error"] = None

        print(f"\n=======================================================")
        print(f" Downloading Model: {model_name} ({repo_id})")
        print(f"=======================================================")

        try:
            snapshot_dir = self._get_snapshot_dir(repo_id)

            # 1. Download smaller metadata/config files
            for f in cfg["files"]:
                fname = f["filename"]
                if not f["is_large"]:
                    print(f"Downloading metadata: {fname}...")
                    hf_hub_download(repo_id=repo_id, filename=fname, token=token)

            # 2. Check or link existing T5Gemma from another snapshot
            target_t5_dir = os.path.join(snapshot_dir, "t5gemma-b-b-ul2")
            if not self.check_file_installed(repo_id, "t5gemma-b-b-ul2/model.safetensors", 1000):
                self._sync_t5gemma_from_existing(target_t5_dir)

            # 3. If T5Gemma components are still missing, download them
            for f in T5GEMMA_FILES:
                fname = f["filename"]
                target_path = os.path.join(snapshot_dir, fname.replace("/", os.sep))
                min_mb = f.get("expected_min_mb")
                if not self.check_file_installed(repo_id, fname, min_mb):
                    if f["is_large"]:
                        print(f"Downloading large conditioner: {fname} (multi-stream)...")
                        self._fast_download_file(repo_id, fname, target_path, progress_cb)
                    else:
                        print(f"Downloading conditioner asset: {fname}...")
                        hf_hub_download(repo_id=repo_id, filename=fname, token=token)
                else:
                    print(f"Conditioner component already present: {fname}")

            # 4. Download the main DiT checkpoint
            for f in cfg["files"]:
                if f["is_large"]:
                    fname = f["filename"]
                    target_path = os.path.join(snapshot_dir, fname.replace("/", os.sep))
                    min_mb = f.get("expected_min_mb")
                    if not self.check_file_installed(repo_id, fname, min_mb):
                        print(f"Downloading main checkpoint: {fname} ({self.num_workers} streams)...")
                        self._fast_download_file(repo_id, fname, target_path, progress_cb)
                    else:
                        print(f"Main checkpoint already verified: {fname}")

            self.current_download_state["is_downloading"] = False
            self.current_download_state["progress_pct"] = 100.0
            print(f"\n[SUCCESS] Model '{model_name}' is fully downloaded and verified!")
            return True

        except Exception as e:
            self.current_download_state["is_downloading"] = False
            self.current_download_state["error"] = str(e)
            print(f"[ERROR] Download failed for '{model_name}': {e}")
            raise

    def download_all(self, progress_cb: Optional[Callable[[Dict[str, Any]], None]] = None):
        for m in MODEL_REGISTRY.keys():
            self.download_model(m, progress_cb)

# Global shared downloader instance
model_downloader = ModelDownloader()

def main():
    parser = argparse.ArgumentParser(description="Stable Audio 3 Model Downloader")
    parser.add_argument(
        "--model",
        choices=["small-sfx", "small-music", "small-music-base", "all"],
        default="status",
        help="Specify which model to download, or 'all'",
    )
    parser.add_argument("--status", action="store_true", help="Display local installation status of all models")
    parser.add_argument("--token", default=None, help="Explicit Hugging Face token")
    args = parser.parse_args()

    downloader = ModelDownloader(token=args.token)

    if args.status or args.model == "status":
        print("\n--- Stable Audio 3 Models Installation Status ---")
        statuses = downloader.list_all_models_status()
        for s in statuses:
            badge = "[INSTALLED]" if s["is_installed"] else "[MISSING]"
            print(f"{badge:<12} {s['model_name']:<18} ({s['installed_size_mb']} MB) - {s['description']}")
            if not s["is_installed"]:
                print(f"             Missing files: {s['missing_files']}")
        print("")
        return

    if args.model == "all":
        downloader.download_all()
    else:
        downloader.download_model(args.model)

if __name__ == "__main__":
    main()
