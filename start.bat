@echo off
rem Starts the observatory (page, sessions API, Trace viewer) on http://127.0.0.1:8899/ and opens it.
setlocal
cd /d "%~dp0"
if not exist trace\node_modules (
  echo First run: installing dependencies...
  call npm run setup || exit /b 1
)
start "" cmd /c "ping -n 3 127.0.0.1 >nul & start http://127.0.0.1:8899/"
call npm start
