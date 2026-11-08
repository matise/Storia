@echo off
setlocal
echo =======================================================
echo  Storia: Stable Audio 3 Background Daemon
echo  Models: small-sfx, small-music, small-music-base
echo  Device: CUDA (FP16, Low-VRAM Shared Engine)
echo =======================================================

set PYTHON_EXE=C:\Users\matij\.conda\envs\ComfyNew\python.exe
set PYTHONNOUSERSITE=1
set PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

if not exist "%PYTHON_EXE%" (
    echo [ERROR] Conda python environment not found at: %PYTHON_EXE%
    pause
    exit /b 1
)

cd /d "%~dp0"
echo Starting FastAPI daemon on http://127.0.0.1:8000...
"%PYTHON_EXE%" -s server.py
pause

