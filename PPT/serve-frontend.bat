@echo off
chcp 65001 >nul
cd /d "%~dp0..\frontend"
echo.
echo  请在浏览器打开:
echo  http://127.0.0.1:8876/app.html?embed=1#dashboard
echo  DataAgent: http://127.0.0.1:8876/app.html?embed=1^&ai=1#dashboard
echo.
python -m http.server 8876
if errorlevel 1 (
  echo 未检测到 Python，请安装后重试。
  pause
)
