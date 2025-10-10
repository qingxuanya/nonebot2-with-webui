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

        await AuthService.create_default_admin()

        try:
            await SystemService.update_bot_status(is_running=False)
        except Exception:
            pass

        try:
            await LogService.add_system_log("INFO", "WebUI管理系统启动完成", "system")
        except Exception:
            pass

    except Exception as e:
        
        try:
            await LogService.add_system_log("ERROR", f"模块注册失败: {e}", "system")
        except:
            pass
