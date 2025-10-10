from modules.auth.service import AuthService
from fastapi import HTTPException, Request
from functools import wraps


def verify_token(token: str) -> bool:
    """验证访问令牌"""
    if not token:
        return False
    # 实际验证逻辑在AuthService中
    return True


def login_required(func):
    """登录要求装饰器"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break

        if not request:
            for value in kwargs.values():
                if isinstance(value, Request):
                    request = value
                    break

        if not request:
            raise HTTPException(status_code=401, detail="未授权")

        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=401, detail="未登录")

        session_info = await AuthService.validate_session(token)
        if not session_info:
            raise HTTPException(status_code=401, detail="会话已过期")

        # 将用户信息添加到请求状态
        request.state.user = session_info

        return await func(*args, **kwargs)

    return wrapper