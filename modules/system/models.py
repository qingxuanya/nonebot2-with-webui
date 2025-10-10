from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from datetime import datetime

# 必须从core.database导入Base，确保所有模型使用同一个Base
from core.database import Base


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True)
    config_key = Column(String(100), unique=True, nullable=False)
    config_value = Column(JSON)
    description = Column(String(200))
    updated_at = Column(DateTime, default=datetime.now)

    def __repr__(self):
        return f"<SystemConfig(key='{self.config_key}', value='{self.config_value}')>"


class BotStatus(Base):
    __tablename__ = "bot_status"

    id = Column(Integer, primary_key=True)
    is_running = Column(Boolean, default=False)
    start_time = Column(DateTime)
    last_restart = Column(DateTime)
    total_messages = Column(Integer, default=0)
    active_groups = Column(Integer, default=0)
    active_users = Column(Integer, default=0)

    def __repr__(self):
        return f"<BotStatus(is_running={self.is_running}, start_time={self.start_time}, last_restart={self.last_restart})>"