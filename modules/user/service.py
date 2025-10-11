from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, or_
from .models import UserProfile, UserPermission, UserStatistics
from core.database import get_db_session
from datetime import datetime, timedelta


class UserService:
    @staticmethod
    async def get_users(
            page: int = 1,
            page_size: int = 20,
            search: str = None,
            banned: bool = None,
            sort_by: str = "last_active",
            sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """获取用户列表 - 使用ORM"""
        async with get_db_session() as session:
            query = select(UserProfile)

            # 搜索条件
            if search:
                query = query.where(
                    or_(
                        UserProfile.user_id.contains(search),
                        UserProfile.username.contains(search),
                        UserProfile.nickname.contains(search)
                    )
                )

            if banned is not None:
                query = query.where(UserProfile.is_global_banned == banned)

            # 总数
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            # 排序
            if sort_by == "last_active":
                order_field = UserProfile.last_active
            elif sort_by == "level":
                order_field = UserProfile.level
            elif sort_by == "experience":
                order_field = UserProfile.experience
            else:
                order_field = UserProfile.last_active

            if sort_order == "desc":
                query = query.order_by(order_field.desc())
            else:
                query = query.order_by(order_field.asc())

            # 分页
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await session.execute(query)
            users = result.scalars().all()

            # 获取用户统计信息
            user_stats = {}
            for user in users:
                stats_result = await session.execute(
                    select(UserStatistics).where(UserStatistics.user_id == user.user_id)
                )
                stats = stats_result.scalar_one_or_none()
                user_stats[user.user_id] = {
                    "total_messages": stats.total_messages if stats else 0,
                    "total_commands": stats.total_commands if stats else 0,
                    "active_days": stats.active_days if stats else 0,
                    "last_command": stats.last_command if stats else None,
                    "favorite_plugin": stats.favorite_plugin if stats else None
                }

            return {
                "users": [{
                    "id": user.id,
                    "user_id": user.user_id,
                    "username": user.username,
                    "nickname": user.nickname,
                    "avatar": user.avatar,
                    "level": user.level,
                    "experience": user.experience,
                    "coins": user.coins,
                    "is_global_banned": user.is_global_banned,
                    "global_ban_reason": user.global_ban_reason,
                    "global_ban_time": user.global_ban_time,
                    "last_active": user.last_active,
                    "settings": user.settings,
                    "created_at": user.created_at,
                    "updated_at": user.updated_at
                } for user in users],
                "user_stats": user_stats,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }

    @staticmethod
    async def get_user_detail(user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户详情 - 使用ORM"""
        async with get_db_session() as session:
            # 用户基本信息
            result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            )
            user = result.scalar_one_or_none()

            if not user:
                return None

            # 用户统计信息
            stats_result = await session.execute(
                select(UserStatistics).where(UserStatistics.user_id == user_id)
            )
            stats = stats_result.scalar_one_or_none()

            # 用户权限
            perm_result = await session.execute(
                select(UserPermission).where(UserPermission.user_id == user_id)
            )
            permissions = perm_result.scalars().all()

            # 群组信息
            from modules.group.models import GroupUser
            group_result = await session.execute(
                select(GroupUser).where(GroupUser.user_id == user_id)
            )
            groups = group_result.scalars().all()

            return {
                "profile": {
                    "id": user.id,
                    "user_id": user.user_id,
                    "username": user.username,
                    "nickname": user.nickname,
                    "avatar": user.avatar,
                    "level": user.level,
                    "experience": user.experience,
                    "coins": user.coins,
                    "is_global_banned": user.is_global_banned,
                    "global_ban_reason": user.global_ban_reason,
                    "global_ban_time": user.global_ban_time,
                    "last_active": user.last_active,
                    "settings": user.settings,
                    "created_at": user.created_at,
                    "updated_at": user.updated_at
                },
                "statistics": {
                    "total_messages": stats.total_messages if stats else 0,
                    "total_commands": stats.total_commands if stats else 0,
                    "active_days": stats.active_days if stats else 0,
                    "last_command": stats.last_command if stats else None,
                    "favorite_plugin": stats.favorite_plugin if stats else None
                } if stats else {},
                "permissions": [{
                    "id": perm.id,
                    "user_id": perm.user_id,
                    "permission_key": perm.permission_key,
                    "permission_value": perm.permission_value,
                    "expires_at": perm.expires_at,
                    "granted_by": perm.granted_by,
                    "granted_at": perm.granted_at
                } for perm in permissions],
                "groups": [{
                    "id": group.id,
                    "group_id": group.group_id,
                    "user_id": group.user_id,
                    "user_name": group.user_name,
                    "user_card": group.user_card,
                    "join_time": group.join_time,
                    "last_speak": group.last_speak,
                    "message_count": group.message_count,
                    "role": group.role,
                    "is_banned": group.is_banned,
                    "ban_reason": group.ban_reason,
                    "ban_time": group.ban_time,
                    "settings": group.settings,
                    "created_at": group.created_at,
                    "updated_at": group.updated_at
                } for group in groups]
            }

    @staticmethod
    async def ban_user_globally(user_id: str, reason: str = "", duration_days: int = None) -> bool:
        """全局封禁用户 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            )
            user = result.scalar_one_or_none()

            if not user:
                return False

            user.is_global_banned = True
            user.global_ban_reason = reason
            user.global_ban_time = datetime.now()

            # 如果有封禁时长，可以设置自动解封时间
            if duration_days:
                user.settings = user.settings or {}
                user.settings["ban_duration"] = duration_days
                user.settings["auto_unban_time"] = (datetime.now() + timedelta(days=duration_days)).isoformat()

            await session.commit()
            return True

    @staticmethod
    async def unban_user_globally(user_id: str) -> bool:
        """全局解封用户 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            )
            user = result.scalar_one_or_none()

            if not user:
                return False

            user.is_global_banned = False
            user.global_ban_reason = ""
            user.global_ban_time = None

            # 清理封禁设置
            if user.settings and "ban_duration" in user.settings:
                user.settings.pop("ban_duration", None)
                user.settings.pop("auto_unban_time", None)

            await session.commit()
            return True

    @staticmethod
    async def update_user_permission(user_id: str, permission_key: str, permission_value: Any,
                                     expires_at: datetime = None, granted_by: str = "system") -> bool:
        """更新用户权限 - 使用ORM"""
        async with get_db_session() as session:
            # 检查是否已存在该权限
            result = await session.execute(
                select(UserPermission).where(
                    and_(
                        UserPermission.user_id == user_id,
                        UserPermission.permission_key == permission_key
                    )
                )
            )
            existing_perm = result.scalar_one_or_none()

            if existing_perm:
                existing_perm.permission_value = permission_value
                existing_perm.expires_at = expires_at
                existing_perm.granted_by = granted_by
            else:
                new_perm = UserPermission(
                    user_id=user_id,
                    permission_key=permission_key,
                    permission_value=permission_value,
                    expires_at=expires_at,
                    granted_by=granted_by
                )
                session.add(new_perm)

            await session.commit()
            return True

    @staticmethod
    async def get_user_stats() -> Dict[str, Any]:
        """获取用户统计信息 - 使用ORM"""
        async with get_db_session() as session:
            # 总用户数
            total_users = await session.execute(select(func.count(UserProfile.id)))
            total = total_users.scalar_one()

            # 活跃用户数（最近7天有活动）
            week_ago = datetime.now() - timedelta(days=7)
            active_users = await session.execute(
                select(func.count(UserProfile.id)).where(UserProfile.last_active >= week_ago)
            )
            active = active_users.scalar_one()

            # 封禁用户数
            banned_users = await session.execute(
                select(func.count(UserProfile.id)).where(UserProfile.is_global_banned == True)
            )
            banned = banned_users.scalar_one()

            return {
                "total_users": total,
                "active_users": active,
                "banned_users": banned,
                "active_rate": round((active / total) * 100, 2) if total > 0 else 0
            }

    @staticmethod
    async def update_user_profile(
            user_id: str,
            username: str = None,
            nickname: str = None,
            last_active: datetime = None
    ):
        """更新用户资料"""
        async with get_db_session() as session:
            try:
                # 查找现有用户
                result = await session.execute(
                    select(UserProfile).where(UserProfile.user_id == user_id)
                )
                user = result.scalar_one_or_none()

                if user:
                    # 更新现有用户
                    if username:
                        user.username = username
                    if nickname:
                        user.nickname = nickname
                    if last_active:
                        user.last_active = last_active
                    else:
                        user.last_active = datetime.now()
                else:
                    # 创建新用户
                    user = UserProfile(
                        user_id=user_id,
                        username=username or f"用户{user_id}",
                        nickname=nickname,
                        last_active=last_active or datetime.now()
                    )
                    session.add(user)

                    # 同时创建用户统计记录
                    user_stats = UserStatistics(
                        user_id=user_id,
                        total_messages=0,
                        total_commands=0,
                        active_days=1
                    )
                    session.add(user_stats)

                await session.commit()
                print(f"✅ 用户资料更新: {user_id}")
            except Exception as e:
                print(f"❌ 更新用户资料失败: {e}")
                await session.rollback()