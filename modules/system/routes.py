from fastapi import APIRouter, Depends, HTTPException, Request
from .service import SystemService
from core.nonebot_manager import nonebot_manager
from core.security import verify_token
import asyncio
from datetime import datetime

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status")
async def get_system_status(request: Request):
    """获取系统状态"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    bot_status = await SystemService.get_bot_status()
    nb_status = nonebot_manager.get_status()

    # 强制同步状态 - 以管理器状态为准
    if bot_status["is_running"] != nb_status["is_running"]:
        print(f"状态不同步: 数据库={bot_status['is_running']}, 管理器={nb_status['is_running']}")
        print("正在同步状态到数据库...")
        await SystemService.force_sync_status(nb_status["is_running"])
        # 重新获取状态
        bot_status = await SystemService.get_bot_status()
        print(f"状态同步完成: 数据库={bot_status['is_running']}")

    # 确保时间格式正确
    response_data = {
        "bot": bot_status,
        "nonebot": nb_status,
        "system": {
            "platform": "linux",
            "python_version": "3.9+",
            "nonebot_version": "2.0.0+"
        }
    }

    print(f"返回状态数据: {response_data}")
    return response_data


@router.post("/start")
async def start_bot(request: Request):
    """启动机器人"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    print("收到启动机器人请求")
    success = await nonebot_manager.start_nonebot()
    if success:
        return {"message": "机器人启动成功"}
    else:
        raise HTTPException(status_code=500, detail="启动失败")


@router.post("/stop")
async def stop_bot(request: Request):
    """停止机器人"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    print("收到停止机器人请求")
    success = await nonebot_manager.shutdown_nonebot()
    if success:
        return {"message": "机器人已停止"}
    else:
        raise HTTPException(status_code=500, detail="停止失败")


@router.post("/restart")
async def restart_bot(request: Request):
    """重启机器人"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    print("收到重启机器人请求")
    success = await nonebot_manager.restart_nonebot()
    if success:
        # 重启时更新最后重启时间
        await SystemService.update_bot_status(last_restart=datetime.now())
        return {"message": "机器人重启成功"}
    else:
        raise HTTPException(status_code=500, detail="重启失败")


@router.get("/config")
async def get_bot_config(request: Request):
    """获取机器人配置"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return nonebot_manager.current_config


@router.put("/config")
async def update_bot_config(request: Request, config: dict):
    """更新机器人配置"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    success = await nonebot_manager.save_config(config)
    if success:
        # 如果机器人正在运行，重启以应用新配置
        if nonebot_manager.is_running:
            asyncio.create_task(nonebot_manager.restart_nonebot(config))
        return {"message": "配置更新成功"}
    else:
        raise HTTPException(status_code=500, detail="配置更新失败")



@router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    """获取仪表板完整统计数据"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    try:
        from modules.log.service import LogService
        from modules.user.service import UserService
        from modules.plugin.service import PluginService
        from modules.group.service import GroupService

        # 并行获取所有统计数据
        user_stats, plugin_stats, log_stats, group_stats = await asyncio.gather(
            UserService.get_user_stats(),
            PluginService.get_plugin_stats(),
            LogService.get_log_stats(),
            GroupService.get_group_stats(),
            return_exceptions=True
        )

        # 处理可能的异常
        if isinstance(user_stats, Exception): user_stats = {}
        if isinstance(plugin_stats, Exception): plugin_stats = {}
        if isinstance(log_stats, Exception): log_stats = {}
        if isinstance(group_stats, Exception): group_stats = {}

        return {
            "success": True,
            "data": {
                "user_stats": user_stats,
                "plugin_stats": plugin_stats,
                "log_stats": log_stats,
                "group_stats": group_stats
            }
        }

    except Exception as e:
        print(f"获取仪表板数据失败: {e}")
        return {"success": False, "error": str(e)}