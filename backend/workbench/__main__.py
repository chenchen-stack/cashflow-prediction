"""在 backend 目录下执行: python -m workbench"""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("WORKBENCH_PORT", "8010"))
    uvicorn.run(
        "workbench.app:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        reload_dirs=[os.path.dirname(os.path.dirname(os.path.abspath(__file__)))],
    )
