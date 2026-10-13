@echo off
rem Starts the observatory (page, sessions API, Trace viewer) and opens it in the browser.
setlocal
cd /d "%~dp0"
if not exist trace\node_modules (
  echo First run: installing dependencies...
  call npm run setup || exit /b 1
)
call npm start -- --open
