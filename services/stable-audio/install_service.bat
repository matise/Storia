@echo off
setlocal

echo ============================================================================
echo  Storia: Background Services ^& Standard Python Installer
echo  Target Service: Stable Audio 3 Daemon (PyTorch CUDA + FastAPI)
echo ============================================================================
echo.

cd /d "%~dp0"

set "UNATTENDED=0"
for %%A in (%*) do (
    if /i "%%~A"=="--yes" set "UNATTENDED=1"
    if /i "%%~A"=="-y" set "UNATTENDED=1"
    if /i "%%~A"=="--unattended" set "UNATTENDED=1"
)

where py >nul 2>nul
if not errorlevel 1 (
    echo Available Python runtimes registered with Windows py launcher:
    py -0p
    echo.
)

call "%~dp0resolve_python.bat"

if not defined PYTHON_EXE (
    echo [WARNING] No standard Python installation was found.
    if "%UNATTENDED%"=="0" (
        echo Installing Python 3.11 via winget...
        winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements
        call "%~dp0resolve_python.bat"
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] Standard Python environment could not be resolved.
    echo Please install Python 3.11 or 3.12 from https://www.python.org/
    if "%UNATTENDED%"=="0" pause
    exit /b 1
)

if "%UNATTENDED%"=="0" (
    echo Detected default Python: %PYTHON_EXE% [v%PYTHON_VER%]
    set /p CUSTOM_VER="Press ENTER to use this Python, or type a py version [e.g. 3.11, 3.12]: "
)

if defined CUSTOM_VER (
    set "STORIA_PYTHON_VERSION=%CUSTOM_VER%"
    if exist "%~dp0.python_env" del /f /q "%~dp0.python_env"
    call "%~dp0resolve_python.bat"
)

if not defined PYTHON_EXE (
    echo [ERROR] Could not resolve requested Python version via py launcher.
    if "%UNATTENDED%"=="0" pause
    exit /b 1
)

"%PYTHON_EXE%" "%~dp0setup_env.py" %*
set "EXIT_CODE=%ERRORLEVEL%"

if "%UNATTENDED%"=="0" (
    echo.
    pause
)
exit /b %EXIT_CODE%
