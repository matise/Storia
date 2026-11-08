import os
import time
import torch
import torchaudio
from engine import StableAudioServiceEngine

def main():
    print("=== Testing StableAudioServiceEngine ===")
    engine = StableAudioServiceEngine(default_device="cuda", model_half=True)
    status0 = engine.get_status()
    print("Initial status:", status0)

    prompt = "Heavy cinematic thunderstorm with rain falling on a metallic roof"
    print(f"\n[Test 1] Generating SFX: '{prompt}' (4.0s, 8 steps)...")
    audio, sr, gen_time = engine.generate(
        prompt=prompt,
        duration=4.0,
        steps=8,
        model_name="small-sfx",
        seed=100
    )
    print(f"Generated {audio.shape} at {sr} Hz in {gen_time:.2f}s")
    out_path = os.path.join(os.path.dirname(__file__), "output_test_rain.wav")
    torchaudio.save(out_path, audio, sr)
    print(f"Saved to {out_path}")
    print("Status after gen:", engine.get_status())

    print("\n[Test 2] Testing Hibernate...")
    hib = engine.hibernate()
    print("Hibernate result:", hib)
    print("Status while hibernating:", engine.get_status())

    print("\n[Test 3] Testing Wake...")
    w = engine.wake()
    print("Wake result:", w)
    print("Status after wake:", engine.get_status())

    print("\n[Test 4] Generating immediate follow-up (warm cache)...")
    audio2, sr2, gen_time2 = engine.generate(
        prompt="Wooden door creaking slowly open in an abandoned hallway",
        duration=2.5,
        steps=8,
        model_name="small-sfx",
        seed=200
    )
    print(f"Warm generation took {gen_time2:.2f}s")
    out_path2 = os.path.join(os.path.dirname(__file__), "output_test_door.wav")
    torchaudio.save(out_path2, audio2, sr2)
    print(f"Saved to {out_path2}")

    print("\n[Test 5] Final Hibernate to clean up GPU...")
    engine.hibernate()
    print("Final VRAM:", engine.get_status()["vram_allocated_mb"], "MB")
    print("\n=== All Engine Tests Passed Successfully! ===")

if __name__ == "__main__":
    main()

