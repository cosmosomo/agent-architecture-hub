@echo off
rem Double-click launcher: start a local static server (http://127.0.0.1:8899)
rem and open the observatory page in the default browser.
rem The page must be served over http - opening the html file directly (file://)
rem breaks fetch() and the docs-source cases stay empty.
setlocal
cd /d "%~dp0"
set PORT=8899
set URL=http://127.0.0.1:%PORT%/

netstat -ano | findstr LISTENING | findstr ":%PORT% " >nul 2>&1
if not errorlevel 1 goto open

where python >nul 2>&1
if not errorlevel 1 (
  start "observatory httpd" /min python -m http.server %PORT% --bind 127.0.0.1
  goto wait
)
where py >nul 2>&1
if not errorlevel 1 (
  start "observatory httpd" /min py -3 -m http.server %PORT% --bind 127.0.0.1
  goto wait
)
echo [observatory] python not found. Install Python 3, or serve this folder on port %PORT% with any static server.
pause
exit /b 1

:wait
ping -n 3 127.0.0.1 >nul

:open
start "" "%URL%"
endlocal
