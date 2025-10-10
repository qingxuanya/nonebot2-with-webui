import hashlib
import secrets
from datetime import datetime
from typing import Optional, Dict, Any
from .models import AdminUser, AdminSession
from core.database import get_db_session
from sqlalchemy import select


class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        """密码哈希"""
        return hashlib.sha256(password.encode()).hexdigest()

    @staticmethod
    async def authenticate_user(username: str, password: str) -> Optional[AdminUser]:
        """用户认证 - 使用ORM"""
        async with get_db_session() as session:
            try:
                # 使用ORM查询
                result = await session.execute(
                    select(AdminUser).where(
                        AdminUser.username == username,
                        AdminUser.is_active == True
                    )
                )
                user = result.scalar_one_or_none()

                if user and user.password_hash == AuthService.hash_password(password):
                    user.last_login = datetime.now()
                    await session.commit()
                    return user
                return None
            except Exception as e:
                print(f"用户认证失败: {e}")
                return None

    @staticmethod
    async def create_session(username: str, ip: str = "", user_agent: str = "") -> str:
        """创建会话 - 使用ORM"""
        session_id = secrets.token_urlsafe(32)
        async with get_db_session() as session:
            try:
                admin_session = AdminSession(
                    session_id=session_id,
                    username=username,
                    ip_address=ip,
                    user_agent=user_agent
                )
                session.add(admin_session)
                await session.commit()
                return session_id
            except Exception as e:
                print(f"创建会话失败: {e}")
                await session.rollback()
                return ""

    @staticmethod
    async def validate_session(session_id: str) -> Optional[Dict[str, Any]]:
        """验证会话 - 使用ORM"""
        if not session_id:
            return None

        async with get_db_session() as session:
            try:
                # 使用ORM查询
                result = await session.execute(
                    select(AdminSession).where(
                        AdminSession.session_id == session_id,
                        AdminSession.is_active == True
                    )
                )
                admin_session = result.scalar_one_or_none()

                if not admin_session or admin_session.is_expired():
                    return None

                # 更新最后活动时间
                admin_session.last_activity = datetime.now()
                await session.commit()

                return {
                    "username": admin_session.username,
                    "login_time": admin_session.login_time,
                    "session_id": admin_session.session_id
                }
            except Exception as e:
                print(f"验证会话失败: {e}")
                return None

    @staticmethod
    async def logout_session(session_id: str) -> bool:
        """注销会话 - 使用ORM"""
        async with get_db_session() as session:
            try:
                # 使用ORM查询
                result = await session.execute(
                    select(AdminSession).where(AdminSession.session_id == session_id)
                )
                admin_session = result.scalar_one_or_none()

                if admin_session:
                    admin_session.is_active = False
                    await session.commit()
                    return True
                return False
            except Exception as e:
                print(f"注销会话失败: {e}")
                await session.rollback()
                return False

    @staticmethod
    async def create_default_admin():
        """创建默认管理员 - 使用ORM"""
        async with get_db_session() as session:
            try:
                # 使用ORM查询
                result = await session.execute(
                    select(AdminUser).where(AdminUser.username == "admin")
                )
                admin = result.scalar_one_or_none()

                if not admin:
                    admin = AdminUser(
                        username="admin",
                        password_hash=AuthService.hash_password("admin123"),
                        is_superuser=True
                    )
                    session.add(admin)
                    await session.commit()
                    print("默认管理员创建成功")
                else:
                    print("默认管理员已存在")
            except Exception as e:
                print(f"创建默认管理员失败: {e}")
                await session.rollback()