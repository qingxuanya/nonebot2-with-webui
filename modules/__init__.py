from fastapi import FastAPI
from .auth.service import AuthService
from .system.service import SystemService
from .user.service import UserService
from core.database import init_database
from modules.log.service import LogService
import asyncio


async def register_modules(app: FastAPI):
    """注册所有模块 - 静默版本"""

    try:
        # 初始化默认管理员
        await AuthService.create_default_admin()

        # 初始化系统状态
        try:
            await SystemService.update_bot_status(is_running=False)
        except Exception:
            pass

        # 记录系统启动日志
        try:
            await LogService.add_system_log("INFO", "WebUI管理系统启动完成", "system")
        except Exception:
            pass

    except Exception as e:
        # 静默处理错误，只记录到数据库
        try:
            await LogService.add_system_log("ERROR", f"模块注册失败: {e}", "system")
        except:
            pass