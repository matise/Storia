@echo off
setlocal
echo =======================================================
echo  Storia: Stable Audio 3 Background Daemon
echo  Models: small-sfx, small-music, small-music-base
echo  Device: CUDA (FP16, Low-VRAM Shared Engine)
echo =======================================================

cd /d "%~dp0"
call "%~dp0resolve_python.bat"

if not defined PYTHON_EXE (
    echo [ERROR] Standard Python environment not found.
    echo Please run install_service.bat first to set up Python and PyTorch.
    pause
    exit /b 1
)

set PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

echo Using Python: %PYTHON_EXE% (v%PYTHON_VER%)
echo Starting FastAPI daemon on http://127.0.0.1:8000...
echo (Press Ctrl+C to stop the daemon at any time)
echo.

"%PYTHON_EXE%" server.py
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% equ 0 (
    echo.
    echo [Server] Daemon stopped cleanly.
) else if %EXIT_CODE% equ 130 (
    echo.
    echo [Server] Daemon stopped by user.
) else (
    echo.
    echo [ERROR] Service exited with code %EXIT_CODE%.
    echo If dependencies are missing or damaged, run: install_service.bat
    pause
)
