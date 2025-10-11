from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_
from .models import Group, GroupUser
from core.database import get_db_session
from datetime import datetime, timedelta


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

    @staticmethod
    async def get_group_stats() -> Dict[str, Any]:
        """获取群组统计信息"""
        async with get_db_session() as session:
            # 总群组数
            total_groups = await session.execute(select(func.count(Group.id)))
            total = total_groups.scalar_one()

            # 启用群组数
            enabled_groups = await session.execute(
                select(func.count(Group.id)).where(Group.is_enabled == True)
            )
            enabled = enabled_groups.scalar_one()

            # 今日活跃群组
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            active_today = await session.execute(
                select(func.count(Group.id)).where(Group.last_active >= today_start)
            )
            active_today_count = active_today.scalar_one()

            return {
                "total_groups": total,
                "enabled_groups": enabled,
                "active_today": active_today_count
            }

    @staticmethod
    async def update_group_info(
            group_id: str,
            group_name: str = None,
            last_active: datetime = None
    ):
        """更新群组信息"""
        async with get_db_session() as session:
            try:
                # 查找现有群组
                result = await session.execute(
                    select(Group).where(Group.group_id == group_id)
                )
                group = result.scalar_one_or_none()

                if group:
                    # 更新现有群组
                    if group_name:
                        group.group_name = group_name
                    if last_active:
                        group.last_active = last_active
                    else:
                        group.last_active = datetime.now()

                    # 更新成员数量
                    group.current_users = await GroupService.get_group_user_count(group_id)
                else:
                    # 创建新群组
                    group = Group(
                        group_id=group_id,
                        group_name=group_name or f"群{group_id}",
                        last_active=last_active or datetime.now(),
                        current_users=1,
                        created_time=datetime.now()
                    )
                    session.add(group)

                await session.commit()
                print(f"✅ 群组信息更新: {group_id}")
            except Exception as e:
                print(f"❌ 更新群组信息失败: {e}")
                await session.rollback()

    @staticmethod
    async def update_group_user(
            group_id: str,
            user_id: str,
            user_name: str = None,
            user_card: str = None,
            last_speak: datetime = None,
            join_time: datetime = None,
            message_count: int = None
    ):
        """更新群组成员信息"""
        async with get_db_session() as session:
            try:
                # 查找现有成员
                result = await session.execute(
                    select(GroupUser).where(
                        GroupUser.group_id == group_id,
                        GroupUser.user_id == user_id
                    )
                )
                group_user = result.scalar_one_or_none()

                if group_user:
                    # 更新现有成员
                    if user_name: group_user.user_name = user_name
                    if user_card: group_user.user_card = user_card
                    if last_speak: group_user.last_speak = last_speak
                    if message_count is not None:
                        group_user.message_count = message_count
                    else:
                        # 如果没有指定message_count，自动增加1
                        group_user.message_count += 1
                else:
                    # 创建新成员
                    group_user = GroupUser(
                        group_id=group_id,
                        user_id=user_id,
                        user_name=user_name or f"用户{user_id}",
                        user_card=user_card,
                        join_time=join_time or datetime.now(),
                        last_speak=last_speak or datetime.now(),
                        message_count=message_count or 1
                    )
                    session.add(group_user)

                await session.commit()
                print(f"✅ 群组成员更新: {group_id} - {user_id}")
            except Exception as e:
                print(f"❌ 更新群组成员失败: {e}")
                await session.rollback()

    @staticmethod
    async def get_group_user_count(group_id: str) -> int:
        """获取群组成员数量"""
        async with get_db_session() as session:
            result = await session.execute(
                select(func.count(GroupUser.id)).where(GroupUser.group_id == group_id)
            )
            return result.scalar_one()

    @staticmethod
    async def get_chatty_users(group_id: str, limit: int = 10):
        """获取话最多的用户"""
        async with get_db_session() as session:
            result = await session.execute(
                select(GroupUser)
                .where(GroupUser.group_id == group_id)
                .order_by(GroupUser.message_count.desc())
                .limit(limit)
            )
            return result.scalars().all()