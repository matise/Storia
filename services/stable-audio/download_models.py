import os
import sys
from huggingface_hub import HfFolder, hf_hub_download

def download():
    token = HfFolder.get_token()
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

