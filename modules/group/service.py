from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_
from .models import Group, GroupUser
from core.database import get_db_session
from datetime import datetime


class GroupService:
    @staticmethod
    async def get_groups(
            page: int = 1,
            page_size: int = 20,
            search: str = None,
            enabled: bool = None
    ) -> Dict[str, Any]:
        """获取群组列表 - 使用ORM"""
        async with get_db_session() as session:
            # 基础查询
            query = select(Group)

            # 搜索条件
            if search:
                query = query.where(
                    Group.group_name.contains(search) |
                    Group.group_id.contains(search)
                )

            if enabled is not None:
                query = query.where(Group.is_enabled == enabled)

            # 总数
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            # 分页数据
            query = query.order_by(Group.updated_at.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await session.execute(query)
            groups = result.scalars().all()

            return {
                "groups": [{
                    "id": group.id,
                    "group_id": group.group_id,
                    "group_name": group.group_name,
                    "group_memo": group.group_memo,
                    "is_enabled": group.is_enabled,
                    "max_users": group.max_users,
                    "current_users": group.current_users,
                    "created_time": group.created_time,
                    "last_active": group.last_active,
                    "settings": group.settings,
                    "created_at": group.created_at,
                    "updated_at": group.updated_at
                } for group in groups],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }

    @staticmethod
    async def get_group(group_id: str) -> Optional[Group]:
        """获取单个群组 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(Group).where(Group.group_id == group_id)
            )
            return result.scalar_one_or_none()

    @staticmethod
    async def update_group(group_id: str, **kwargs) -> bool:
        """更新群组 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(Group).where(Group.group_id == group_id)
            )
            group = result.scalar_one_or_none()

            if not group:
                return False

            for key, value in kwargs.items():
                if hasattr(group, key):
                    setattr(group, key, value)

            group.updated_at = datetime.now()
            await session.commit()
            return True

    @staticmethod
    async def enable_group(group_id: str) -> bool:
        """启用群组 - 使用ORM"""
        return await GroupService.update_group(group_id, is_enabled=True)

    @staticmethod
    async def disable_group(group_id: str) -> bool:
        """禁用群组 - 使用ORM"""
        return await GroupService.update_group(group_id, is_enabled=False)

    @staticmethod
    async def get_group_users(
            group_id: str,
            page: int = 1,
            page_size: int = 20,
            search: str = None,
            banned: bool = None
    ) -> Dict[str, Any]:
        """获取群成员列表 - 使用ORM"""
        async with get_db_session() as session:
            query = select(GroupUser).where(GroupUser.group_id == group_id)

            if search:
                query = query.where(
                    GroupUser.user_name.contains(search) |
                    GroupUser.user_id.contains(search) |
                    GroupUser.user_card.contains(search)
                )

            if banned is not None:
                query = query.where(GroupUser.is_banned == banned)

            # 总数
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            # 分页数据
            query = query.order_by(GroupUser.message_count.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await session.execute(query)
            users = result.scalars().all()

            return {
                "users": [{
                    "id": user.id,
                    "group_id": user.group_id,
                    "user_id": user.user_id,
                    "user_name": user.user_name,
                    "user_card": user.user_card,
                    "join_time": user.join_time,
                    "last_speak": user.last_speak,
                    "message_count": user.message_count,
                    "role": user.role,
                    "is_banned": user.is_banned,
                    "ban_reason": user.ban_reason,
                    "ban_time": user.ban_time,
                    "settings": user.settings,
                    "created_at": user.created_at,
                    "updated_at": user.updated_at
                } for user in users],
                "total": total,
                "page": page,
                "page_size": page_size
            }

    @staticmethod
    async def ban_user(group_id: str, user_id: str, reason: str = "") -> bool:
        """封禁用户 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(GroupUser).where(
                    and_(
                        GroupUser.group_id == group_id,
                        GroupUser.user_id == user_id
                    )
                )
            )
            user = result.scalar_one_or_none()

            if not user:
                return False

            user.is_banned = True
            user.ban_reason = reason
            user.ban_time = datetime.now()
            await session.commit()
            return True

    @staticmethod
    async def unban_user(group_id: str, user_id: str) -> bool:
        """解封用户 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(GroupUser).where(
                    and_(
                        GroupUser.group_id == group_id,
                        GroupUser.user_id == user_id
                    )
                )
            )
            user = result.scalar_one_or_none()

            if not user:
                return False

            user.is_banned = False
            user.ban_reason = ""
            user.ban_time = None
            await session.commit()
            return True