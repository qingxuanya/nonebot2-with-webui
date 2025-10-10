from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from .service import AuthService
from modules.log.service import LogService

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str
    username: str = None


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, response: Response, login_data: LoginRequest):
    """用户登录"""
    user = await AuthService.authenticate_user(login_data.username, login_data.password)

    if not user:
        await LogService.add_system_log("WARNING", f"登录失败: {login_data.username}")
        return LoginResponse(success=False, message="用户名或密码错误")

    # 创建会话
    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    session_id = await AuthService.create_session(user.username, client_host, user_agent)

    if not session_id:
        return LoginResponse(success=False, message="登录失败，请重试")

    # 设置cookie
    response.set_cookie(
        key="access_token",
        value=session_id,
        httponly=True,
        max_age=24 * 60 * 60,  # 24小时
        samesite="lax"
    )

    await LogService.add_system_log("INFO", f"用户登录成功: {user.username}")
    return LoginResponse(
        success=True,
        message="登录成功",
        username=user.username
    )


@router.post("/logout")
async def logout(request: Request, response: Response):
    """用户登出"""
    token = request.cookies.get("access_token")
    if token:
        await AuthService.logout_session(token)
        response.delete_cookie("access_token")

    return {"success": True, "message": "登出成功"}


@router.get("/me")
async def get_current_user(request: Request):
    """获取当前用户信息"""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="未登录")

    session_info = await AuthService.validate_session(token)
    if not session_info:
        raise HTTPException(status_code=401, detail="会话已过期")

    return {
        "username": session_info["username"],
        "login_time": session_info["login_time"],
        "is_authenticated": True
    }


@router.post("/init")
async def initialize_admin():
    """初始化管理员账户"""
    await AuthService.create_default_admin()
    return {"success": True, "message": "默认管理员已创建"}