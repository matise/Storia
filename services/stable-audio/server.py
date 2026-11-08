import os
import sys

# Ensure user site packages don't override conda dependencies
sys.path = [p for p in sys.path if "AppData\\Roaming\\Python" not in p]

import io
import time
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

import torch
import torchaudio
from fastapi import FastAPI, HTTPException, Request, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine import StableAudioServiceEngine

# Global singleton engine and concurrency queue
engine = StableAudioServiceEngine(default_device="cuda", model_half=True)
gpu_lock = asyncio.Lock()
IDLE_HIBERNATE_TIMEOUT_SEC = 300  # Auto-hibernate after 5 minutes of inactivity

# Background idle watcher task
async def idle_watcher():
    while True:
        await asyncio.sleep(30)
        async with gpu_lock:
            if not engine.is_hibernating and engine.current_model is not None:
                idle_time = time.time() - engine.last_active_timestamp
                if idle_time >= IDLE_HIBERNATE_TIMEOUT_SEC:
                    print(f"[Watcher] Inactivity detected ({idle_time:.0f}s >= {IDLE_HIBERNATE_TIMEOUT_SEC}s). Auto-hibernating...")
                    engine.hibernate()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch idle watcher
    watcher_task = asyncio.create_task(idle_watcher())
    print("[Server] Stable Audio 3 Service initialized. Idle watcher active.")
    yield
    # Shutdown
    watcher_task.cancel()
    async with gpu_lock:
        engine.hibernate()

app = FastAPI(
    title="Storia Stable Audio 3 Daemon",
    description="Low-VRAM CUDA-accelerated background service for SFX and Music generation",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Storia frontend (e.g. localhost:5173 / localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Text description of the desired sound effect or music track")
    negative_prompt: Optional[str] = Field("distortion, low quality, noise, clipping", description="Negative prompt")
    duration_seconds: float = Field(3.0, ge=0.5, le=120.0, description="Duration in seconds")
    steps: int = Field(8, ge=1, le=50, description="Diffusion steps (default 8)")
    cfg_scale: float = Field(1.0, ge=0.0, le=10.0, description="Classifier-Free Guidance scale")
    seed: int = Field(-1, description="Random seed (-1 for randomized)")
    chunked_decode: Optional[bool] = Field(None, description="Force chunked decode for lower peak VRAM")

def tensor_to_wav_bytes(audio_tensor: torch.Tensor, sample_rate: int) -> bytes:
    buffer = io.BytesIO()
    # Expects [channels, samples]
    torchaudio.save(buffer, audio_tensor, sample_rate, format="wav")
    return buffer.getvalue()

@app.get("/health")
@app.get("/v1/system/status")
async def get_system_status():
    return engine.get_status()

@app.post("/v1/system/hibernate")
async def trigger_hibernate():
    async with gpu_lock:
        return engine.hibernate()

@app.post("/v1/system/wake")
async def trigger_wake():
    async with gpu_lock:
        return engine.wake()

@app.post("/v1/sfx/generate")
async def generate_sfx(req: GenerateRequest):
    """
    Generate procedural sound effects using 'small-sfx'.
    """
    async with gpu_lock:
        try:
            audio_tensor, sr, gen_time = engine.generate(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt,
                duration=req.duration_seconds,
                steps=req.steps,
                cfg_scale=req.cfg_scale,
                seed=req.seed,
                model_name="small-sfx",
                chunked_decode=req.chunked_decode,
            )
            wav_bytes = tensor_to_wav_bytes(audio_tensor, sr)
            vram = engine.get_vram_stats()
            
            headers = {
                "Content-Disposition": 'attachment; filename="sfx_output.wav"',
                "X-Generation-Time": f"{gen_time:.2f}",
                "X-Sample-Rate": str(sr),
                "X-VRAM-Allocated-MB": str(vram["vram_allocated_mb"]),
            }
            return Response(content=wav_bytes, media_type="audio/wav", headers=headers)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/music/generate")
async def generate_music(req: GenerateRequest, model_variant: str = "small-music"):
    """
    Generate melodic scores and tracks using 'small-music' (or 'small-music-base').
    """
    if model_variant not in ("small-music", "small-music-base"):
        raise HTTPException(status_code=400, detail="Invalid music model variant")

    async with gpu_lock:
        try:
            audio_tensor, sr, gen_time = engine.generate(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt,
                duration=req.duration_seconds,
                steps=req.steps,
                cfg_scale=req.cfg_scale,
                seed=req.seed,
                model_name=model_variant,
                chunked_decode=req.chunked_decode,
            )
            wav_bytes = tensor_to_wav_bytes(audio_tensor, sr)
            vram = engine.get_vram_stats()
            
            headers = {
                "Content-Disposition": 'attachment; filename="music_output.wav"',
                "X-Generation-Time": f"{gen_time:.2f}",
                "X-Sample-Rate": str(sr),
                "X-VRAM-Allocated-MB": str(vram["vram_allocated_mb"]),
            }
            return Response(content=wav_bytes, media_type="audio/wav", headers=headers)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, log_level="info")

