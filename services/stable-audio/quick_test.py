import os
import sys
import time
import requests

def test_generate(prompt="Cinematic sci-fi laser blast with resonant metallic echo", duration=3.0, output_file="test_sfx.wav"):
    url = "http://127.0.0.1:8000/v1/sfx/generate"
    payload = {
        "prompt": prompt,
        "negative_prompt": "distortion, low quality, clipping, noise",
        "duration_seconds": duration,
        "steps": 8,
        "seed": 42
    }

    print(f"Connecting to Stable Audio daemon at {url}...")
    print(f"Prompt: '{prompt}'")
    print(f"Duration: {duration}s | Steps: 8")

    t0 = time.time()
    try:
        response = requests.post(url, json=payload, stream=True)
    except requests.exceptions.ConnectionError:
        print("[ERROR] Could not connect to http://127.0.0.1:8000. Is the background process running?")
        sys.exit(1)

    if response.status_code != 200:
        print(f"[ERROR] Daemon returned status {response.status_code}: {response.text}")
        sys.exit(1)

    out_path = os.path.join(os.path.dirname(__file__), output_file)
    with open(out_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

    total_time = time.time() - t0
    gen_time = response.headers.get("X-Generation-Time", "N/A")
    sr = response.headers.get("X-Sample-Rate", "44100")
    vram = response.headers.get("X-VRAM-Allocated-MB", "N/A")

    print("\n--- Generation Succeeded! ---")
    print(f"File saved to:       {out_path}")
    print(f"File size:           {os.path.getsize(out_path) / 1024:.1f} KB")
    print(f"Sample Rate:         {sr} Hz (Stereo)")
    print(f"Server Gen Time:     {gen_time}s")
    print(f"Total Roundtrip:     {total_time:.2f}s")
    print(f"Active GPU VRAM:     {vram} MB")

    # Try to open/play on Windows
    if sys.platform == "win32":
        print(f"\nLaunching audio player: {output_file}...")
        os.system(f'start "" "{out_path}"')

if __name__ == "__main__":
    prompt_arg = sys.argv[1] if len(sys.argv) > 1 else "Cinematic sci-fi laser blast with resonant metallic echo"
    duration_arg = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
    test_generate(prompt=prompt_arg, duration=duration_arg)

