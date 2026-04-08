@echo off
echo.
taskkill /f /im ChatGPT.exe 2>nul
rmdir /s /q dist
npm run dist:win
echo.
echo.
pause