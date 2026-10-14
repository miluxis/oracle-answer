@echo off
cd /d "%~dp0"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" start_local_preview.py
  goto end
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 start_local_preview.py
  goto end
)
where python >nul 2>nul
if not errorlevel 1 (
  python start_local_preview.py
  goto end
)
echo Python 3 is required. Please install Python 3 and try again.
:end
pause
