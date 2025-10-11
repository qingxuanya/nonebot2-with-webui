from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path


def create_application() -> FastAPI:
    """创建FastAPI应用"""
    app = FastAPI(
        title="NoneBot WebUI管理系统",
        description="完整的NoneBot管理后台",
        version="1.0.0"
    )

    # 添加CORS中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 挂载静态文件
    theme_path = Path("theme/static")
    theme_path.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=theme_path), name="static")

    # 模板配置
    templates_path = Path("web/templates")
    templates_path.mkdir(parents=True, exist_ok=True)
    templates = Jinja2Templates(directory=templates_path)

    # 将模板存储到app state
    app.state.templates = templates

    return app