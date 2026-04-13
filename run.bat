@echo off
chcp 65001 >nul
echo ==========================================
echo   资金预测智能体 - 全栈系统
echo ==========================================
echo.

cd /d "%~dp0backend"

if not exist "venv" (
    echo [1/3] 创建虚拟环境...
    python -m venv venv
)

echo [2/3] 安装依赖...
call venv\Scripts\activate
pip install -r requirements.txt -q

echo [3/3] 启动服务 (http://localhost:8000) ...
echo.
python main.py

pause
