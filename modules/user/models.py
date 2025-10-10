from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from datetime import datetime
from core.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(20), unique=True, nullable=False)
    username = Column(String(100))
    nickname = Column(String(100))
    avatar = Column(String(500))  # 头像URL
    level = Column(Integer, default=1)  # 用户等级
    experience = Column(Integer, default=0)  # 经验值
    coins = Column(Integer, default=0)  # 金币/积分
    is_global_banned = Column(Boolean, default=False)  # 全局封禁
    global_ban_reason = Column(String(200))
    global_ban_time = Column(DateTime)
    last_active = Column(DateTime, default=datetime.now)
    settings = Column(JSON, default=dict)  # 用户设置
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class UserPermission(Base):
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(20), nullable=False)
    permission_key = Column(String(100), nullable=False)  # 权限键
    permission_value = Column(JSON)  # 权限值
    expires_at = Column(DateTime)  # 权限过期时间
    granted_by = Column(String(50))  # 授权人
    granted_at = Column(DateTime, default=datetime.now)


class UserStatistics(Base):
    __tablename__ = "user_statistics"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(20), nullable=False)
    total_messages = Column(Integer, default=0)
    total_commands = Column(Integer, default=0)
    active_days = Column(Integer, default=0)
    last_command = Column(DateTime)
    favorite_plugin = Column(String(100))  # 最常用插件
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)