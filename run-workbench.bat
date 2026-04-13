@echo off
chcp 65001 >nul
echo ==========================================
echo   亿流 Work · 工作台 API（backend\workbench）
echo   端口 8010 丨 主业务仍为 run.bat 的 8000
echo ==========================================
cd /d "%~dp0backend"

set "PY=%~dp0backend\venv\Scripts\python.exe"
if not exist "%PY%" (
  echo 请先运行 run.bat 创建 backend\venv
  pause
  exit /b 1
)
echo 启动: python -m workbench
"%PY%" -m workbench
pause
