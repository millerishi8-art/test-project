@echo off
cd /d "%~dp0"
echo Starting server on http://localhost:5000 ...
node --watch server.js
pause
