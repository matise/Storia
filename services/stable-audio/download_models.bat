@echo off
setlocal
echo =======================================================
echo  Storia: Stable Audio 3 Model Downloader
echo =======================================================

cd /d "%~dp0"
call "%~dp0resolve_python.bat"

if not defined PYTHON_EXE (
    echo [ERROR] Standard Python environment not found.
    echo Please run install_service.bat first to set up Python and PyTorch.
    pause
    exit /b 1
)

echo Using Python: %PYTHON_EXE% (v%PYTHON_VER%)
echo.

if "%~1"=="" (
    echo Checking installed models...
    "%PYTHON_EXE%" downloader.py --status
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
        "%PYTHON_EXE%" downloader.py --model %CHOICE%
    )
) else (
    "%PYTHON_EXE%" downloader.py --model %~1
)

echo.
echo Process complete.
pause
