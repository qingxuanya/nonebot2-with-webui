from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from datetime import datetime
from .service import UserService
from core.security import verify_token

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/")
async def get_users(
        request: Request,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        search: str = Query(None),
        banned: Optional[bool] = Query(None),
        sort_by: str = Query("last_active"),
        sort_order: str = Query("desc")
):
    """获取用户列表"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await UserService.get_users(page, page_size, search, banned, sort_by, sort_order)


@router.get("/stats")
async def get_user_stats(request: Request):
    """获取用户统计"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await UserService.get_user_stats()


@router.get("/{user_id}")
async def get_user_detail(request: Request, user_id: str):
    """获取用户详情"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    user_detail = await UserService.get_user_detail(user_id)
    if not user_detail:
        raise HTTPException(status_code=404, detail="用户不存在")

    return user_detail


@router.post("/{user_id}/ban")
async def ban_user_globally(
        request: Request,
        user_id: str,
        reason: str = "",
        duration_days: Optional[int] = Query(None, ge=1)
):
    """全局封禁用户"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await UserService.ban_user_globally(user_id, reason, duration_days)
    if success:
        return {"success": True, "message": "用户已全局封禁"}
    else:
        raise HTTPException(status_code=404, detail="用户不存在")


@router.post("/{user_id}/unban")
async def unban_user_globally(request: Request, user_id: str):
    """全局解封用户"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await UserService.unban_user_globally(user_id)
    if success:
        return {"success": True, "message": "用户已解封"}
    else:
        raise HTTPException(status_code=404, detail="用户不存在")


@router.post("/{user_id}/permissions")
async def update_user_permission(
        request: Request,
        user_id: str,
        permission_key: str,
        permission_value: str,
        expires_at: Optional[datetime] = None
):
    """更新用户权限"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    # 获取当前用户信息
    session_info = request.state.user
    granted_by = session_info.get("username", "system")

    success = await UserService.update_user_permission(
        user_id, permission_key, permission_value, expires_at, granted_by
    )

    if success:
        return {"success": True, "message": "权限更新成功"}
    else:
        raise HTTPException(status_code=500, detail="权限更新失败")