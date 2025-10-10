from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from datetime import datetime
from core.database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    group_id = Column(String(20), unique=True, nullable=False)
    group_name = Column(String(100))
    group_memo = Column(String(200))  # 群备注
    is_enabled = Column(Boolean, default=True)  # 是否启用机器人
    max_users = Column(Integer, default=500)  # 群最大人数
    current_users = Column(Integer, default=0)  # 当前人数
    created_time = Column(DateTime)  # 群创建时间
    last_active = Column(DateTime, default=datetime.now)  # 最后活动时间
    settings = Column(JSON, default=dict)  # 群设置
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class GroupUser(Base):
    __tablename__ = "group_users"

    id = Column(Integer, primary_key=True)
    group_id = Column(String(20), nullable=False)
    user_id = Column(String(20), nullable=False)
    user_name = Column(String(100))
    user_card = Column(String(100))  # 群名片
    join_time = Column(DateTime)  # 加群时间
    last_speak = Column(DateTime)  # 最后发言时间
    message_count = Column(Integer, default=0)  # 消息数量
    role = Column(String(20), default="member")  # 角色: owner/admin/member
    is_banned = Column(Boolean, default=False)  # 是否被封禁
    ban_reason = Column(String(200))
    ban_time = Column(DateTime)
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)