@echo off
REM ============================================================================
REM Storia: Standard Python Environment Resolver
REM Resolves PYTHON_EXE and PYTHON_VER using the Windows py launcher or PATH
REM without relying on Conda environments.
REM ============================================================================

set "PYTHON_EXE="
set "PYTHON_VER="

REM 1. Explicit environment variable override
if defined STORIA_PYTHON_EXE (
    if exist "%STORIA_PYTHON_EXE%" (
        set "PYTHON_EXE=%STORIA_PYTHON_EXE%"
        goto :found_python
    )
)

REM 2. Persisted environment file created by install_service.bat
if exist "%~dp0.python_env" (
    for /f "usebackq tokens=* delims=" %%A in ("%~dp0.python_env") do (
        if exist "%%~A" (
            set "PYTHON_EXE=%%~A"
            goto :found_python
        )
    )
)

REM 3. Explicit version override via STORIA_PYTHON_VERSION (e.g. 3.11 or 3.12)
if defined STORIA_PYTHON_VERSION (
    where py >nul 2>nul
    if not errorlevel 1 (
        for /f "delims=" %%P in ('py -%STORIA_PYTHON_VERSION% -c "import sys; print(sys.executable)" 2^>nul') do (
            if exist "%%~P" (
                set "PYTHON_EXE=%%~P"
                goto :found_python
            )
        )
    )
)

REM 4. Standard Python via Windows py launcher (prefer 3.11 -> 3.12 -> 3.10 -> default 3)
where py >nul 2>nul
if not errorlevel 1 (
    for %%V in (3.11 3.12 3.10 3.13 3.14 3) do (
        for /f "delims=" %%P in ('py -%%V -c "import sys; print(sys.executable)" 2^>nul') do (
            if exist "%%~P" (
                set "PYTHON_EXE=%%~P"
                goto :found_python
            )
        )
    )
)

REM 5. Fallback to standard python on PATH (excluding WindowsApps Microsoft Store stub)
for /f "delims=" %%P in ('python -c "import sys; print(sys.executable)" 2^>nul') do (
    echo "%%~P" | findstr /i "WindowsApps" >nul
    if errorlevel 1 (
        if exist "%%~P" (
            set "PYTHON_EXE=%%~P"
            goto :found_python
        )
    )
)

exit /b 1

:found_python
for /f "tokens=2 delims= " %%V in ('""%PYTHON_EXE%" --version 2>&1"') do (
    set "PYTHON_VER=%%~V"
)
exit /b 0
