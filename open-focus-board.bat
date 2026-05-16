@echo off
setlocal
set "DIR=%~dp0"
set "PORT=4173"
set "URL=http://localhost:%PORT%/index.html"
set "CHROME_64=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME_32=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

REM Focus Board now uses ES modules + a service worker, which browsers block
REM on file://. So we serve the folder over http://localhost first.

where py >nul 2>nul && (
  start "Focus Board server" /min cmd /c "cd /d ""%DIR%"" && py -m http.server %PORT%"
  goto :open
)
where python >nul 2>nul && (
  start "Focus Board server" /min cmd /c "cd /d ""%DIR%"" && python -m http.server %PORT%"
  goto :open
)
where node >nul 2>nul && (
  start "Focus Board server" /min cmd /c "node ""%DIR%serve.mjs"""
  goto :open
)

echo Khong tim thay Python hoac Node de chay local server.
echo Cai Python (python.org) hoac Node (nodejs.org) roi chay lai file nay.
pause
exit /b 1

:open
REM Give the server a moment to start, then open the browser.
timeout /t 2 /nobreak >nul

if exist "%CHROME_64%" (
  start "" "%CHROME_64%" --app=%URL%
  exit /b
)
if exist "%CHROME_32%" (
  start "" "%CHROME_32%" --app=%URL%
  exit /b
)
start "" "%URL%"
