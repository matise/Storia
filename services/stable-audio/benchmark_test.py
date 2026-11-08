import os
import sys
import time
import torch
import torchaudio
from stable_audio_3 import StableAudioModel

def format_mb(bytes_val):
    return f"{bytes_val / (1024 * 1024):.1f} MB"

def main():
    print(f"PyTorch Version: {torch.__version__}")
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if not torch.cuda.is_available():
        print("CUDA is required for this benchmark test.")
        sys.exit(1)

    device_name = torch.cuda.get_device_name(0)
    print(f"Using GPU: {device_name}")
    torch.cuda.reset_peak_memory_stats()
    vram_start = torch.cuda.memory_allocated()

    print("\n--- Loading 'small-sfx' model (model_half=True / FP16) ---")
    t0 = time.time()
    model = StableAudioModel.from_pretrained("small-sfx", device="cuda", model_half=True)
    load_time = time.time() - t0
    vram_loaded = torch.cuda.memory_allocated()
    print(f"Model loaded in {load_time:.2f}s")
    print(f"VRAM after load: {format_mb(vram_loaded)} (Delta: {format_mb(vram_loaded - vram_start)})")

    prompt = "A high-tech cinematic laser blast firing with resonant metal echo"
    print(f"\n--- Generating test audio (duration: 3.0s, steps: 8) ---")
    print(f"Prompt: '{prompt}'")
    
    t_gen_start = time.time()
    with torch.inference_mode():
        audio = model.generate(
            prompt=prompt,
            negative_prompt="distortion, low quality, noise",
            duration=3.0,
            steps=8,
            cfg_scale=1.0,
            seed=42,
        )
    gen_time = time.time() - t_gen_start
    peak_vram = torch.cuda.max_memory_allocated()

    print(f"Generation completed in {gen_time:.2f}s")
    print(f"Peak VRAM during inference: {format_mb(peak_vram)}")
    print(f"Output audio tensor shape: {audio.shape}, dtype: {audio.dtype}")

    # Save audio output
    output_path = os.path.join(os.path.dirname(__file__), "output_test_sfx.wav")
    audio_tensor = audio[0] if audio.ndim == 3 else audio
    # Ensure float32 for wav saving
    torchaudio.save(output_path, audio_tensor.to(torch.float32).cpu(), 44100)
    print(f"Saved audio output to: {output_path}")

    # Test hibernation / memory release
    print("\n--- Testing VRAM Release / Hibernation ---")
    model.model.to("cpu")
    del model
    torch.cuda.empty_cache()
    vram_after_release = torch.cuda.memory_allocated()
    print(f"VRAM after unloading and empty_cache: {format_mb(vram_after_release)}")
    print("\nBenchmark test finished successfully!")

if __name__ == "__main__":
    main()

