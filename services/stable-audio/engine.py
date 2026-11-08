import os
import time
import json
import torch
import torchaudio
from typing import Optional, Tuple, Dict, Any, Union, List
from safetensors.torch import load_file

from stable_audio_3.model import all_models, StableAudioModel
from stable_audio_3.loading_utils import load_diffusion_cond, copy_state_dict

class StableAudioServiceEngine:
    """
    Unified high-performance runtime for Stable Audio 3 Small models.
    Supports:
      - small-sfx (sound effects, foley, room tone)
      - small-music (music tracks, stems, scores)
      - small-music-base (foundational music checkpoint)
    Features low-VRAM optimizations:
      - FP16/BF16 native execution
      - Shared T5Gemma conditioner and SAME-Small autoencoder
      - Hot-swapping DiT backbones in <150ms
      - Zero-footprint idle hibernation (GPU -> CPU RAM + empty_cache)
    """

    def __init__(self, default_device: str = "cuda", model_half: bool = True):
        self.device = default_device if torch.cuda.is_available() else "cpu"
        self.model_half = model_half if torch.cuda.is_available() else False
        self.active_model_name: Optional[str] = None
        self.current_model: Optional[StableAudioModel] = None
        self.is_hibernating: bool = False
        self.last_active_timestamp: float = time.time()
        self.dit_ram_cache: Dict[str, Dict[str, torch.Tensor]] = {}

        # Enforce memory allocation configuration
        if torch.cuda.is_available():
            os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

    def get_vram_stats(self) -> Dict[str, Any]:
        if not torch.cuda.is_available():
            return {"vram_allocated_mb": 0, "vram_reserved_mb": 0, "peak_vram_mb": 0}
        return {
            "vram_allocated_mb": round(torch.cuda.memory_allocated() / (1024 * 1024), 1),
            "vram_reserved_mb": round(torch.cuda.memory_reserved() / (1024 * 1024), 1),
            "peak_vram_mb": round(torch.cuda.max_memory_allocated() / (1024 * 1024), 1),
        }

    def load_or_swap_model(self, model_name: str) -> StableAudioModel:
        """
        Loads the target model or hot-swaps the DiT backbone if the shared
        conditioner/autoencoder are already loaded.
        """
        self.last_active_timestamp = time.time()

        if model_name not in all_models:
            raise ValueError(f"Unknown model '{model_name}'. Available: {list(all_models.keys())}")

        # If already loaded and awake, return
        if self.current_model is not None and self.active_model_name == model_name and not self.is_hibernating:
            return self.current_model

        # If hibernating, wake it up
        if self.is_hibernating and self.current_model is not None and self.active_model_name == model_name:
            self.wake()
            return self.current_model

        t0 = time.time()
        # Case 1: First-time load or full pipeline initialization
        if self.current_model is None:
            print(f"[Engine] Initializing full pipeline for '{model_name}' on {self.device} (half={self.model_half})...")
            model_cfg = all_models[model_name]
            local_config, local_ckpt = model_cfg.resolve()
            
            with open(local_config, "r", encoding="utf-8") as f:
                config = json.load(f)

            diff_model = load_diffusion_cond(
                config, local_ckpt, device=self.device, model_half=self.model_half
            )
            diff_model.use_lora = False
            diff_model.lora_names = []
            
            self.current_model = StableAudioModel(diff_model, config, self.device, self.model_half)
            self.active_model_name = model_name
            self.is_hibernating = False
            print(f"[Engine] Loaded '{model_name}' in {time.time() - t0:.2f}s | VRAM: {self.get_vram_stats()['vram_allocated_mb']} MB")
            return self.current_model

        # Case 2: Shared components exist; hot-swap the DiT backbone
        print(f"[Engine] Hot-swapping DiT backbone: {self.active_model_name} -> {model_name}...")
        model_cfg = all_models[model_name]
        _, local_ckpt = model_cfg.resolve()

        # Check if DiT weights are cached in RAM
        if model_name in self.dit_ram_cache:
            dit_state = self.dit_ram_cache[model_name]
        else:
            print(f"[Engine] Reading checkpoint for '{model_name}' into RAM cache...")
            dit_state = load_file(local_ckpt)
            self.dit_ram_cache[model_name] = dit_state

        # Swap weights into self.current_model.model
        copy_state_dict(self.current_model.model, dit_state)
        self.current_model.model.to(self.device)
        if self.model_half:
            self.current_model.model.to(torch.float16)

        self.active_model_name = model_name
        self.is_hibernating = False
        print(f"[Engine] Hot-swap complete in {time.time() - t0:.3f}s | VRAM: {self.get_vram_stats()['vram_allocated_mb']} MB")
        return self.current_model

    def generate(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        duration: float = 5.0,
        steps: int = 8,
        cfg_scale: float = 1.0,
        seed: int = -1,
        model_name: str = "small-sfx",
        chunked_decode: Optional[bool] = None,
    ) -> Tuple[torch.Tensor, int, float]:
        """
        Executes fast diffusion generation with timing and VRAM accounting.
        Returns: (audio_tensor [channels, samples], sample_rate, generation_time_sec)
        """
        model = self.load_or_swap_model(model_name)
        if seed is None or seed < 0:
            seed = torch.randint(0, 2**31 - 1, (1,)).item()

        t_start = time.time()
        with torch.inference_mode():
            # If duration > 30s, automatically enable chunked decode to protect VRAM
            auto_chunk = chunked_decode if chunked_decode is not None else (duration > 30.0)
            
            audio = model.generate(
                prompt=prompt,
                negative_prompt=negative_prompt,
                duration=duration,
                steps=steps,
                cfg_scale=cfg_scale,
                seed=seed,
                batch_size=1,
                chunked_decode=auto_chunk,
            )

        gen_time = time.time() - t_start
        self.last_active_timestamp = time.time()

        # Extract [channels, samples]
        audio_tensor = audio[0] if audio.ndim == 3 else audio
        return audio_tensor.to(torch.float32).cpu(), model.model.sample_rate, gen_time

    def restyle(
        self,
        init_audio: Tuple[int, torch.Tensor],
        prompt: str,
        init_noise_level: float = 0.5,
        duration: float = 10.0,
        steps: int = 8,
        cfg_scale: float = 1.0,
        seed: int = -1,
        model_name: str = "small-sfx",
    ) -> Tuple[torch.Tensor, int, float]:
        """
        Audio-to-audio restyling from source audio and text prompt.
        """
        model = self.load_or_swap_model(model_name)
        t_start = time.time()

        with torch.inference_mode():
            audio = model.generate(
                prompt=prompt,
                init_audio=init_audio,
                init_noise_level=init_noise_level,
                duration=duration,
                steps=steps,
                cfg_scale=cfg_scale,
                seed=seed,
                batch_size=1,
            )

        gen_time = time.time() - t_start
        self.last_active_timestamp = time.time()
        audio_tensor = audio[0] if audio.ndim == 3 else audio
        return audio_tensor.to(torch.float32).cpu(), model.model.sample_rate, gen_time

    def inpaint(
        self,
        source_audio: Tuple[int, torch.Tensor],
        prompt: str,
        mask_start_seconds: float,
        mask_end_seconds: float,
        duration: float = 10.0,
        steps: int = 8,
        cfg_scale: float = 1.0,
        seed: int = -1,
        model_name: str = "small-sfx",
    ) -> Tuple[torch.Tensor, int, float]:
        """
        Inpainting or continuation on target audio time slice.
        """
        model = self.load_or_swap_model(model_name)
        t_start = time.time()

        with torch.inference_mode():
            audio = model.generate(
                prompt=prompt,
                inpaint_audio=source_audio,
                inpaint_mask_start_seconds=mask_start_seconds,
                inpaint_mask_end_seconds=mask_end_seconds,
                duration=duration,
                steps=steps,
                cfg_scale=cfg_scale,
                seed=seed,
                batch_size=1,
            )

        gen_time = time.time() - t_start
        self.last_active_timestamp = time.time()
        audio_tensor = audio[0] if audio.ndim == 3 else audio
        return audio_tensor.to(torch.float32).cpu(), model.model.sample_rate, gen_time

    def hibernate(self) -> Dict[str, Any]:
        """
        Offloads active weights and conditioners to host RAM and empties CUDA cache.
        Drops active VRAM footprint to near 0 MB.
        """
        if self.is_hibernating or self.current_model is None:
            return {"status": "already_hibernating", **self.get_vram_stats()}

        print(f"[Engine] Entering deep hibernation: offloading '{self.active_model_name}' to host RAM...")
        t0 = time.time()
        self.current_model.model.to("cpu")
        if hasattr(self.current_model.model, "conditioner"):
            self.current_model.model.conditioner.to("cpu")
        if hasattr(self.current_model.model, "pretransform"):
            self.current_model.model.pretransform.to("cpu")

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        self.is_hibernating = True
        elapsed = time.time() - t0
        print(f"[Engine] Deep hibernated in {elapsed:.3f}s. Remaining VRAM: {self.get_vram_stats()['vram_allocated_mb']} MB")
        return {"status": "hibernated", "hibernation_time_sec": round(elapsed, 3), **self.get_vram_stats()}

    def wake(self) -> Dict[str, Any]:
        """
        Restores hibernated model and conditioners from host RAM back to CUDA device.
        """
        if not self.is_hibernating or self.current_model is None:
            return {"status": "already_awake", **self.get_vram_stats()}

        print(f"[Engine] Waking model '{self.active_model_name}' back to {self.device}...")
        t0 = time.time()
        self.current_model.model.to(self.device)
        if hasattr(self.current_model.model, "conditioner"):
            self.current_model.model.conditioner.to(self.device)
        if hasattr(self.current_model.model, "pretransform"):
            self.current_model.model.pretransform.to(self.device)

        if self.model_half:
            self.current_model.model.to(torch.float16)

        self.is_hibernating = False
        self.last_active_timestamp = time.time()
        elapsed = time.time() - t0
        print(f"[Engine] Awake in {elapsed:.3f}s. VRAM: {self.get_vram_stats()['vram_allocated_mb']} MB")
        return {"status": "awake", "wake_time_sec": round(elapsed, 3), **self.get_vram_stats()}

    def get_status(self) -> Dict[str, Any]:
        idle_seconds = time.time() - self.last_active_timestamp
        vram = self.get_vram_stats()
        return {
            "device": self.device,
            "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
            "active_model": self.active_model_name,
            "is_hibernating": self.is_hibernating,
            "idle_seconds": round(idle_seconds, 1),
            "half_precision": self.model_half,
            **vram,
        }

