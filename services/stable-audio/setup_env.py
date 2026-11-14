import os
import sys
import shutil
import argparse
import subprocess
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent
REQUIREMENTS_FILE = SERVICE_DIR / "requirements.txt"
PYTHON_ENV_FILE = SERVICE_DIR / ".python_env"
PYTORCH_CUDA_INDEX = "https://download.pytorch.org/whl/cu126"
STABLE_AUDIO_REPO = "git+https://github.com/Stability-AI/stable-audio-3.git"


def run_cmd(cmd: list[str], check: bool = True) -> int:
    print(f"  > {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {result.returncode}: {' '.join(cmd)}")
    return result.returncode


def check_torch_cuda() -> tuple[bool, str]:
    try:
        import torch
        import torchaudio  # noqa: F401
        ver_str = torch.__version__.split("+")[0]
        parts = [int(p) for p in ver_str.split(".")[:2] if p.isdigit()]
        major_minor = tuple(parts) if len(parts) >= 2 else (0, 0)

        if not torch.cuda.is_available():
            return False, f"torch {torch.__version__} (CPU-only build detected; CUDA required)"
        if major_minor < (2, 4):
            return False, f"torch {torch.__version__} (PyTorch >= 2.4 required for Stable Audio 3)"

        dev_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        return True, f"torch {torch.__version__} | GPU: {dev_name} ({vram_gb:.1f} GB VRAM)"
    except Exception as e:
        return False, f"Not installed ({e})"


def install_torch_cuda(python_exe: str) -> None:
    print(f"\n[Step 3/6] Installing CUDA-accelerated PyTorch & TorchAudio ({PYTORCH_CUDA_INDEX})...")
    rc = run_cmd(
        [
            python_exe, "-m", "pip", "install",
            "torch==2.7.1+cu126", "torchaudio==2.7.1+cu126",
            "--index-url", PYTORCH_CUDA_INDEX,
        ],
        check=False,
    )
    if rc != 0:
        print("  [INFO] torch==2.7.1+cu126 wheel not available for this Python version; installing latest cu126 wheels...")
        run_cmd(
            [
                python_exe, "-m", "pip", "install", "--upgrade",
                "torch", "torchaudio",
                "--index-url", PYTORCH_CUDA_INDEX,
            ],
            check=True,
        )


def verify_environment(python_exe: str) -> None:
    print("\n[Step 6/6] Running environment & import verification...")
    verify_code = (
        "import sys, torch, torchaudio, fastapi, uvicorn, safetensors, transformers, huggingface_hub, stable_audio_3; "
        "from transformers import T5GemmaEncoderModel; "
        "from stable_audio_3.model import all_models, StableAudioModel; "
        "from stable_audio_3.loading_utils import load_diffusion_cond, copy_state_dict; "
        "assert torch.cuda.is_available(), 'CUDA is not available in PyTorch!'; "
        "assert 'Placeholder' not in repr(T5GemmaEncoderModel), 'PyTorch version is too old for Transformers (< 2.6)!'; "
        "print(f'  [OK] Python       : {sys.version.split()[0]} ({sys.executable})'); "
        "print(f'  [OK] PyTorch      : {torch.__version__} | CUDA Available: {torch.cuda.is_available()}'); "
        "print(f'  [OK] GPU Device   : {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"CPU\"}'); "
        "print(f'  [OK] TorchAudio   : {torchaudio.__version__}'); "
        "print(f'  [OK] FastAPI      : {fastapi.__version__}'); "
        "print(f'  [OK] Uvicorn      : {uvicorn.__version__}'); "
        "print(f'  [OK] Safetensors  : {safetensors.__version__}'); "
        "print(f'  [OK] Transformers : {transformers.__version__} (T5Gemma active)'); "
        "print(f'  [OK] HF Hub       : {huggingface_hub.__version__}'); "
        "print(f'  [OK] StableAudio3 : {list(all_models.keys())}')"
    )
    run_cmd([python_exe, "-c", verify_code], check=True)


def interactive_hf_and_models(python_exe: str) -> None:
    print("\n----------------------------------------------------------------------------")
    print(" Optional Setup: Hugging Face Authentication & Model Checkpoints")
    print("----------------------------------------------------------------------------")
    from huggingface_hub import login
    try:
        from huggingface_hub import get_token as hf_get_token
    except ImportError:
        from huggingface_hub import HfFolder
        hf_get_token = HfFolder.get_token

    existing_token = os.environ.get("HF_TOKEN") or hf_get_token()
    if existing_token:
        print("  [OK] Hugging Face access token is already configured.")
    else:
        print("  [INFO] No Hugging Face token detected.")
        print("  A Hugging Face token is required to download gated Stable Audio 3 checkpoints.")
        token_input = input("  Paste your Hugging Face token (hf_...) or press ENTER to skip: ").strip()
        if token_input:
            try:
                login(token=token_input, add_to_git_credential=False)
                print("  [OK] Hugging Face token saved successfully.")
            except Exception as e:
                print(f"  [WARNING] Could not save Hugging Face token: {e}")

    print("\nChecking local Stable Audio 3 model status...")
    run_cmd([python_exe, str(SERVICE_DIR / "downloader.py"), "--status"], check=False)

    print("Would you like to download Stable Audio 3 models now?")
    print("  1 = small-sfx        (Sound effects, foley, ambient audio)")
    print("  2 = small-music      (Melodic scores, instruments, music)")
    print("  3 = small-music-base (Foundational music base checkpoint)")
    print("  4 = all              (Download all models)")
    print("  ENTER = Skip for now")
    choice = input("Select option [1 / 2 / 3 / 4 / ENTER to skip]: ").strip().lower()

    choice_map = {
        "1": "small-sfx",
        "2": "small-music",
        "3": "small-music-base",
        "4": "all",
        "small-sfx": "small-sfx",
        "small-music": "small-music",
        "small-music-base": "small-music-base",
        "all": "all",
    }
    target_model = choice_map.get(choice)
    if target_model:
        run_cmd([python_exe, str(SERVICE_DIR / "downloader.py"), "--model", target_model], check=False)


def main() -> int:
    parser = argparse.ArgumentParser(description="Storia Background Services Installer (Standard Python)")
    parser.add_argument("--yes", "-y", "--unattended", dest="unattended", action="store_true", help="Run non-interactively")
    parser.add_argument("--upgrade-torch", action="store_true", help="Force install/upgrade of PyTorch CUDA cu126 wheels")
    args = parser.parse_args()

    python_exe = sys.executable
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    print("\n[Step 1/6] Persisting target Standard Python environment...")
    print(f"  Executable : {python_exe}")
    print(f"  Version    : Python {py_ver}")
    PYTHON_ENV_FILE.write_text(f"{python_exe}\n", encoding="utf-8")
    print(f"  Saved to   : {PYTHON_ENV_FILE}")

    print("\n[Step 2/6] Checking Git & upgrading pip, setuptools, wheel...")
    if not shutil.which("git"):
        print("  [WARNING] 'git' executable not found on PATH. Installing git+https packages requires Git.")
        if not args.unattended and shutil.which("winget"):
            ans = input("  Install Git via winget now? [Y/n]: ").strip().lower()
            if ans in ("", "y", "yes"):
                run_cmd(["winget", "install", "-e", "--id", "Git.Git", "--accept-package-agreements", "--accept-source-agreements"], check=False)

    run_cmd([python_exe, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"])

    print("\n[Step 3/6] Checking PyTorch CUDA status...")
    cuda_ok, status_msg = check_torch_cuda()
    print(f"  Status: {status_msg}")

    do_install_torch = args.upgrade_torch or not cuda_ok
    if cuda_ok and not args.upgrade_torch and not args.unattended:
        ans = input("  CUDA PyTorch is already active. Upgrade/reinstall to torch 2.7.1+cu126 anyway? [y/N]: ").strip().lower()
        if ans in ("y", "yes"):
            do_install_torch = True

    if do_install_torch:
        install_torch_cuda(python_exe)
    else:
        print("  Keeping existing working CUDA PyTorch installation.")

    print("\n[Step 4/6] Installing service & model runtime dependencies (requirements.txt)...")
    run_cmd([python_exe, "-m", "pip", "install", "-r", str(REQUIREMENTS_FILE)])

    print("\n[Step 5/6] Checking / installing Stability-AI/stable-audio-3 package...", flush=True)
    try:
        import stable_audio_3  # noqa: F401
        print("  [OK] stable_audio_3 is already installed.")
    except ImportError:
        run_cmd([python_exe, "-m", "pip", "install", "--no-deps", STABLE_AUDIO_REPO])

    verify_environment(python_exe)

    print("\n============================================================================")
    print(" [SUCCESS] Standard Python environment and background services are ready!")
    print("============================================================================")

    if not args.unattended:
        interactive_hf_and_models(python_exe)

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(130)
    except Exception as exc:
        print(f"\n[ERROR] Installation failed: {exc}", file=sys.stderr)
        sys.exit(1)
