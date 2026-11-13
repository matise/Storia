@echo off
setlocal
echo =======================================================
echo  Storia: Stable Audio 3 Model Downloader
echo =======================================================

set PYTHON_EXE=C:\Users\matij\.conda\envs\ComfyNew\python.exe
set PYTHONNOUSERSITE=1

if not exist "%PYTHON_EXE%" (
    echo [ERROR] Conda python environment not found at: %PYTHON_EXE%
    pause
    exit /b 1
)

cd /d "%~dp0"

if "%~1"=="" (
    echo Checking installed models...
    "%PYTHON_EXE%" -s downloader.py --status
    echo.
    echo Usage options:
    echo   download_models.bat small-sfx
    echo   download_models.bat small-music
    echo   download_models.bat small-music-base
    echo   download_models.bat all
    echo.
    set /p CHOICE="Enter model to download [small-sfx / small-music / all / exit]: "
    if /i "%CHOICE%"=="exit" exit /b 0
    if not "%CHOICE%"=="" (
        "%PYTHON_EXE%" -s downloader.py --model %CHOICE%
    )
) else (
    "%PYTHON_EXE%" -s downloader.py --model %~1
)

echo.
echo Process complete.
pause

