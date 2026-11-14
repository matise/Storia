import os
import sys
from huggingface_hub import hf_hub_download
try:
    from huggingface_hub import get_token as hf_get_token
except ImportError:
    from huggingface_hub import HfFolder
    hf_get_token = HfFolder.get_token

def download():
    token = os.environ.get("HF_TOKEN") or hf_get_token()
    if not token:
        print("ERROR: No Hugging Face token found in cache!")
        sys.exit(1)
    os.environ["HF_TOKEN"] = token
    print("HF Token confirmed.")

    repo_id = "stabilityai/stable-audio-3-small-sfx"
    print(f"Downloading model.safetensors from {repo_id}...")
    path = hf_hub_download(
        repo_id=repo_id,
        filename="model.safetensors",
        token=token
    )
    print(f"Downloaded model.safetensors successfully to: {path}")

if __name__ == "__main__":
    download()

