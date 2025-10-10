from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from core.database import Base


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True)
    group_id = Column(String(20), nullable=False)
    user_id = Column(String(20), nullable=False)
    user_name = Column(String(100))
    message_type = Column(String(20))  # group/private
    message_content = Column(Text)
    raw_message = Column(Text)
    timestamp = Column(DateTime, default=datetime.now)
    is_recalled = Column(Boolean, default=False)  # 是否被撤回


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True)
    level = Column(String(20))  # DEBUG/INFO/WARNING/ERROR/CRITICAL
    module = Column(String(100))
    message = Column(Text)
    details = Column(Text)  # 详细错误信息
    user_id = Column(String(20))  # 操作用户
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.now)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True)
    operator = Column(String(50))  # 操作者
    operation_type = Column(String(50))  # 操作类型
    target_type = Column(String(50))  # 目标类型
    target_id = Column(String(50))  # 目标ID
    description = Column(Text)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.now)