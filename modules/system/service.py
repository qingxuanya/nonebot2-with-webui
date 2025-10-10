from .models import SystemConfig, BotStatus
from core.database import get_db_session, Base, main_engine
from typing import Any, Dict, Optional
from sqlalchemy import select
from datetime import datetime


class SystemService:
    @staticmethod
    async def _ensure_table_exists() -> bool:
        """确保bot_status表存在 - 静默版本"""
        try:
            async with get_db_session() as session:
                try:
                    # 使用ORM方式检查表是否存在
                    result = await session.execute(select(BotStatus).limit(1))
                    return True
                except Exception:
                    # 静默创建表，不输出调试信息
                    try:
                        async with main_engine.begin() as conn:
                            await conn.run_sync(BotStatus.__table__.create)

                        # 创建初始记录
                        initial_status = BotStatus(is_running=False)
                        session.add(initial_status)
                        await session.commit()

                        return True
                    except Exception:
                        await session.rollback()
                        return False
        except Exception:
            return False

    @staticmethod
    async def get_bot_status() -> Dict[str, Any]:
        """获取机器人状态 - 静默版本"""
        # 确保表存在
        table_exists = await SystemService._ensure_table_exists()
        if not table_exists:
            from core.nonebot_manager import nonebot_manager
            return {
                "is_running": nonebot_manager.is_running,
                "start_time": None,
                "last_restart": None,
                "total_messages": 0,
                "active_groups": 0,
                "active_users": 0
            }

        async with get_db_session() as session:
            try:
                # 使用ORM查询
                result = await session.execute(select(BotStatus).order_by(BotStatus.id.desc()).limit(1))
                status = result.scalar_one_or_none()

                if not status:
                    # 如果不存在，创建默认状态
                    status = BotStatus(is_running=False)
                    session.add(status)
                    await session.commit()
                    await session.refresh(status)

                # 格式化时间显示
                start_time_str = status.start_time.isoformat() if status.start_time else None
                last_restart_str = status.last_restart.isoformat() if status.last_restart else None

                return {
                    "is_running": status.is_running,
                    "start_time": start_time_str,
                    "last_restart": last_restart_str,
                    "total_messages": status.total_messages,
                    "active_groups": status.active_groups,
                    "active_users": status.active_users
                }
            except Exception:
                from core.nonebot_manager import nonebot_manager
                return {
                    "is_running": nonebot_manager.is_running,
                    "start_time": None,
                    "last_restart": None,
                    "total_messages": 0,
                    "active_groups": 0,
                    "active_users": 0
                }

    @staticmethod
    async def update_bot_status(**kwargs) -> bool:
        """更新机器人状态 - 静默版本"""
        # 确保表存在
        table_exists = await SystemService._ensure_table_exists()
        if not table_exists:
            return False

        async with get_db_session() as session:
            try:
                # 使用ORM查询现有状态
                result = await session.execute(select(BotStatus).order_by(BotStatus.id.desc()).limit(1))
                status = result.scalar_one_or_none()

                if not status:
                    # 如果不存在，创建新记录
                    status = BotStatus()
                    session.add(status)

                # 更新字段
                for key, value in kwargs.items():
                    if hasattr(status, key):
                        setattr(status, key, value)

                # 特殊处理运行状态变化
                if 'is_running' in kwargs:
                    current_time = datetime.now()
                    if kwargs['is_running']:
                        status.start_time = current_time
                    else:
                        status.last_restart = current_time

                await session.commit()
                return True
            except Exception:
                await session.rollback()
                return False

    @staticmethod
    async def force_sync_status(is_running: bool):
        """强制同步状态 - 静默版本"""
        # 确保表存在
        table_exists = await SystemService._ensure_table_exists()
        if not table_exists:
            return False

        async with get_db_session() as session:
            try:
                # 使用ORM查询
                result = await session.execute(select(BotStatus).order_by(BotStatus.id.desc()).limit(1))
                status = result.scalar_one_or_none()

                if not status:
                    status = BotStatus(is_running=is_running)
                    session.add(status)
                else:
                    status.is_running = is_running

                current_time = datetime.now()
                if is_running:
                    status.start_time = current_time
                else:
                    status.last_restart = current_time

                await session.commit()
                return True
            except Exception:
                await session.rollback()
                return False