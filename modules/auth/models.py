from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime, timedelta
from core.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(100), unique=True, nullable=False)
    username = Column(String(50), nullable=False)
    login_time = Column(DateTime, default=datetime.now)
    last_activity = Column(DateTime, default=datetime.now)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    is_active = Column(Boolean, default=True)

    def is_expired(self, expiry_hours: int = 24):
        return datetime.now() > self.login_time + timedelta(hours=expiry_hours)