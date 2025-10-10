from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from .service import GroupService
from core.security import verify_token

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("/")
async def get_groups(
        request: Request,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        search: str = Query(None),
        enabled: Optional[bool] = Query(None)
):
    """获取群组列表"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await GroupService.get_groups(page, page_size, search, enabled)


@router.get("/{group_id}")
async def get_group_detail(request: Request, group_id: str):
    """获取群组详情"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    group = await GroupService.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="群组不存在")

    return group.__dict__


@router.post("/{group_id}/enable")
async def enable_group(request: Request, group_id: str):
    """启用群组"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await GroupService.enable_group(group_id)
    if success:
        return {"success": True, "message": "群组已启用"}
    else:
        raise HTTPException(status_code=404, detail="群组不存在")


@router.post("/{group_id}/disable")
async def disable_group(request: Request, group_id: str):
    """禁用群组"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await GroupService.disable_group(group_id)
    if success:
        return {"success": True, "message": "群组已禁用"}
    else:
        raise HTTPException(status_code=404, detail="群组不存在")


@router.get("/{group_id}/users")
async def get_group_users(
        request: Request,
        group_id: str,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        search: str = Query(None),
        banned: Optional[bool] = Query(None)
):
    """获取群成员列表"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await GroupService.get_group_users(group_id, page, page_size, search, banned)


@router.post("/{group_id}/users/{user_id}/ban")
async def ban_user(
        request: Request,
        group_id: str,
        user_id: str,
        reason: str = ""
):
    """封禁用户"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await GroupService.ban_user(group_id, user_id, reason)
    if success:
        return {"success": True, "message": "用户已封禁"}
    else:
        raise HTTPException(status_code=404, detail="用户不存在")


@router.post("/{group_id}/users/{user_id}/unban")
async def unban_user(request: Request, group_id: str, user_id: str):
    """解封用户"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await GroupService.unban_user(group_id, user_id)
    if success:
        return {"success": True, "message": "用户已解封"}
    else:
        raise HTTPException(status_code=404, detail="用户不存在")