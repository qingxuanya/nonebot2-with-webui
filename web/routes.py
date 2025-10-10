from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse
from modules.auth.service import AuthService


async def auth_middleware(request: Request):
    """认证中间件"""
    # 跳过登录页面和静态文件
    if request.url.path in ['/login', '/'] or request.url.path.startswith('/static') or request.url.path.startswith(
            '/api/auth'):
        return

    # 检查认证
    token = request.cookies.get("access_token")
    if not token:
        return RedirectResponse(url="/login")

    session_info = await AuthService.validate_session(token)
    if not session_info:
        return RedirectResponse(url="/login")


def register_web_routes(app: FastAPI):
    """注册所有Web路由"""

    # 添加认证中间件
    @app.middleware("http")
    async def add_auth_middleware(request: Request, call_next):
        response = await auth_middleware(request)
        if response:
            return response
        return await call_next(request)

    # API路由
    from modules.auth.routes import router as auth_router
    from modules.system.routes import router as system_router
    from modules.group.routes import router as group_router
    from modules.plugin.routes import router as plugin_router
    from modules.log.routes import router as log_router
    from modules.user.routes import router as user_router

    app.include_router(auth_router)
    app.include_router(system_router)
    app.include_router(group_router)
    app.include_router(plugin_router)
    app.include_router(log_router)
    app.include_router(user_router)

    # Web页面路由
    from .server import WebUIServer
    web_ui = WebUIServer(app)
    web_ui.setup_routes()