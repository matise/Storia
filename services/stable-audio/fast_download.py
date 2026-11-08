import os
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from huggingface_hub import HfFolder, hf_hub_url

def fast_download(repo_id, filename, target_path, num_workers=8):
    token = HfFolder.get_token()
    url = hf_hub_url(repo_id=repo_id, filename=filename)
    headers = {"authorization": f"Bearer {token}"}

    # Get total file size via HEAD
    head = requests.head(url, headers=headers, allow_redirects=True)
    if head.status_code != 200:
        raise RuntimeError(f"Failed to fetch HEAD for {url}: status {head.status_code}")
    
    total_size = int(head.headers.get("content-length", 0))
    direct_url = head.url # Final CDN URL after redirect
    print(f"File: {filename} | Total Size: {total_size / (1024*1024):.2f} MB | Workers: {num_workers}")

    # If file exists and size matches, skip
    if os.path.exists(target_path) and os.path.getsize(target_path) == total_size:
        print(f"File already downloaded and complete at: {target_path}")
        return target_path

    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    part_size = total_size // num_workers

    # Allocate file
    with open(target_path, "wb") as f:
        f.seek(total_size - 1)
        f.write(b"\0")

    def download_range(part_idx, start_byte, end_byte):
        rng_headers = {"Range": f"bytes={start_byte}-{end_byte}"}
        # If redirected URL requires auth headers or signed URL
        r = requests.get(direct_url, headers=rng_headers, stream=True)
        if r.status_code not in (200, 206):
            # Fallback to base URL with token
            r = requests.get(url, headers={"authorization": f"Bearer {token}", "Range": f"bytes={start_byte}-{end_byte}"}, stream=True)
        
        with open(target_path, "r+b") as out_f:
            out_f.seek(start_byte)
            downloaded = 0
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    out_f.write(chunk)
                    downloaded += len(chunk)
        return part_idx, downloaded

    ranges = []
    for i in range(num_workers):
        start = i * part_size
        end = total_size - 1 if i == num_workers - 1 else (i + 1) * part_size - 1
        ranges.append((i, start, end))

    t0 = time.time()
    total_downloaded = 0
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(download_range, *r) for r in ranges]
        for f in as_completed(futures):
            idx, bytes_done = f.result()
            total_downloaded += bytes_done
            pct = (total_downloaded / total_size) * 100
            elapsed = time.time() - t0
            speed = (total_downloaded / (1024 * 1024)) / elapsed if elapsed > 0 else 0
            print(f"Chunk {idx+1}/{num_workers} done | Progress: {pct:.1f}% ({speed:.2f} MB/s)")

    print(f"\nDownload finished in {time.time() - t0:.1f}s -> {target_path}")
    return target_path

if __name__ == "__main__":
    from stable_audio_3.model import all_models
    import json
    
    cfg = all_models["small-sfx"]
    from huggingface_hub import hf_hub_download
    cfg_path = hf_hub_download(repo_id=cfg.repo_id, filename=cfg.config_path)
    snapshot_dir = os.path.dirname(cfg_path)
    
    # Download t5gemma model.safetensors
    target_t5gemma = os.path.join(snapshot_dir, "t5gemma-b-b-ul2", "model.safetensors")
    fast_download(
        repo_id=cfg.repo_id,
        filename="t5gemma-b-b-ul2/model.safetensors",
        target_path=target_t5gemma,
        num_workers=8
    )


