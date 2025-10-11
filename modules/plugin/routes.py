from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from .service import PluginService
from core.security import verify_token

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


@router.get("/")
async def get_plugins(
        request: Request,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        search: str = Query(None),
        enabled: Optional[bool] = Query(None)
):
    """获取插件列表"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await PluginService.get_plugins(page, page_size, search, enabled)


@router.get("/stats")
async def get_plugin_stats(request: Request):
    """获取插件统计"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await PluginService.get_plugin_stats()


@router.post("/{plugin_name}/enable")
async def enable_plugin(request: Request, plugin_name: str):
    """启用插件"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await PluginService.toggle_global_plugin(plugin_name, True)
    if success:
        return {"success": True, "message": "插件已启用"}
    else:
        raise HTTPException(status_code=404, detail="插件不存在")


@router.post("/{plugin_name}/disable")
async def disable_plugin(request: Request, plugin_name: str):
    """禁用插件"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await PluginService.toggle_global_plugin(plugin_name, False)
    if success:
        return {"success": True, "message": "插件已禁用"}
    else:
        raise HTTPException(status_code=404, detail="插件不存在")


@router.post("/{plugin_name}/groups/{group_id}/enable")
async def enable_group_plugin(request: Request, plugin_name: str, group_id: str):
    """启用群组插件"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await PluginService.toggle_group_plugin(plugin_name, group_id, True)
    if success:
        return {"success": True, "message": "群组插件已启用"}
    else:
        raise HTTPException(status_code=500, detail="操作失败")


@router.post("/{plugin_name}/groups/{group_id}/disable")
async def disable_group_plugin(request: Request, plugin_name: str, group_id: str):
    """禁用群组插件"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await PluginService.toggle_group_plugin(plugin_name, group_id, False)
    if success:
        return {"success": True, "message": "群组插件已禁用"}
    else:
        raise HTTPException(status_code=500, detail="操作失败")


# 新增：获取群组插件设置
@router.get("/groups/{group_id}/settings")
async def get_group_plugin_settings(
    request: Request,
    group_id: str
):
    """获取群组插件设置"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    try:
        settings = await PluginService.get_group_plugin_settings(group_id)
        return {
            "settings": settings,
            "success": True
        }
    except Exception as e:
        print(f"获取群组插件设置失败: {e}")
        raise HTTPException(status_code=500, detail="获取群组插件设置失败")