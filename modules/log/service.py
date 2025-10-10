from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_
from .models import MessageLog, SystemLog, OperationLog
from core.database import get_db_session
from datetime import datetime, timedelta


class LogService:
    @staticmethod
    async def add_system_log(level: str, message: str, module: str = "system", details: str = "", user_id: str = ""):
        """添加系统日志 - 只记录到数据库"""
        async with get_db_session() as session:
            log = SystemLog(
                level=level,
                module=module,
                message=message,
                details=details,
                user_id=user_id
            )
            session.add(log)
            await session.commit()

    @staticmethod
    async def add_operation_log(operator: str, operation_type: str, target_type: str,
                                target_id: str, description: str, ip: str = "", user_agent: str = ""):
        """添加操作日志 - 只记录到数据库"""
        async with get_db_session() as session:
            log = OperationLog(
                operator=operator,
                operation_type=operation_type,
                target_type=target_type,
                target_id=target_id,
                description=description,
                ip_address=ip,
                user_agent=user_agent
            )
            session.add(log)
            await session.commit()

    @staticmethod
    async def get_message_logs(
            group_id: str = None,
            user_id: str = None,
            page: int = 1,
            page_size: int = 20,
            start_time: datetime = None,
            end_time: datetime = None
    ) -> Dict[str, Any]:
        """获取消息日志"""
        async with get_db_session() as session:
            # 构建查询
            query = select(MessageLog)

            # 添加过滤条件
            conditions = []
            if group_id:
                conditions.append(MessageLog.group_id == group_id)
            if user_id:
                conditions.append(MessageLog.user_id == user_id)
            if start_time:
                conditions.append(MessageLog.timestamp >= start_time)
            if end_time:
                conditions.append(MessageLog.timestamp <= end_time)

            if conditions:
                query = query.where(and_(*conditions))

            # 总数查询
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            # 分页数据查询
            query = query.order_by(MessageLog.timestamp.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await session.execute(query)
            logs = result.scalars().all()

            return {
                "logs": [{
                    "id": log.id,
                    "group_id": log.group_id,
                    "user_id": log.user_id,
                    "user_name": log.user_name,
                    "message_type": log.message_type,
                    "message_content": log.message_content,
                    "raw_message": log.raw_message,
                    "timestamp": log.timestamp,
                    "is_recalled": log.is_recalled
                } for log in logs],
                "total": total,
                "page": page,
                "page_size": page_size
            }

    @staticmethod
    async def get_system_logs(
            level: str = None,
            module: str = None,
            page: int = 1,
            page_size: int = 20,
            days: int = 7
    ) -> Dict[str, Any]:
        """获取系统日志"""
        async with get_db_session() as session:
            start_time = datetime.now() - timedelta(days=days)
            query = select(SystemLog).where(SystemLog.created_at >= start_time)

            # 添加过滤条件
            if level:
                query = query.where(SystemLog.level == level)
            if module:
                query = query.where(SystemLog.module.contains(module))

            # 总数查询
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            # 分页数据查询
            query = query.order_by(SystemLog.created_at.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await session.execute(query)
            logs = result.scalars().all()

            return {
                "logs": [{
                    "id": log.id,
                    "level": log.level,
                    "module": log.module,
                    "message": log.message,
                    "details": log.details,
                    "user_id": log.user_id,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at
                } for log in logs],
                "total": total,
                "page": page,
                "page_size": page_size
            }

    @staticmethod
    async def get_operation_logs(
            operator: str = None,
            operation_type: str = None,
            page: int = 1,
            page_size: int = 20,
            days: int = 30
    ) -> Dict[str, Any]:
        """获取操作日志"""
        async with get_db_session() as session:
            start_time = datetime.now() - timedelta(days=days)
            query = select(OperationLog).where(OperationLog.created_at >= start_time)

            # 添加过滤条件
            if operator:
                query = query.where(OperationLog.operator == operator)
            if operation_type:
                query = query.where(OperationLog.operation_type == operation_type)

            # 总数查询
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            # 分页数据查询
            query = query.order_by(OperationLog.created_at.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await session.execute(query)
            logs = result.scalars().all()

            return {
                "logs": [{
                    "id": log.id,
                    "operator": log.operator,
                    "operation_type": log.operation_type,
                    "target_type": log.target_type,
                    "target_id": log.target_id,
                    "description": log.description,
                    "ip_address": log.ip_address,
                    "user_agent": log.user_agent,
                    "created_at": log.created_at
                } for log in logs],
                "total": total,
                "page": page,
                "page_size": page_size
            }

    @staticmethod
    async def get_log_stats() -> Dict[str, Any]:
        """获取日志统计"""
        async with get_db_session() as session:
            # 消息日志统计
            message_count = await session.execute(select(func.count(MessageLog.id)))
            message_total = message_count.scalar_one()

            # 今日消息
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_messages = await session.execute(
                select(func.count(MessageLog.id)).where(MessageLog.timestamp >= today_start)
            )
            today_message_count = today_messages.scalar_one()

            # 系统日志按级别统计
            level_stats_result = await session.execute(
                select(SystemLog.level, func.count(SystemLog.id))
                .where(SystemLog.created_at >= today_start)
                .group_by(SystemLog.level)
            )
            system_level_stats = dict(level_stats_result.all())

            return {
                "message_total": message_total,
                "today_messages": today_message_count,
                "system_level_stats": system_level_stats
            }