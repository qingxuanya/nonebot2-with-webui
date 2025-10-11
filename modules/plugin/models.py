from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from datetime import datetime
from core.database import Base


class Plugin(Base):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True)
    plugin_name = Column(String(100), unique=True, nullable=False)
    plugin_module = Column(String(200))  # 插件模块路径
    display_name = Column(String(100))  # 显示名称
    description = Column(Text)  # 插件描述
    version = Column(String(20))  # 版本号
    author = Column(String(100))  # 作者
    is_global_enabled = Column(Boolean, default=True)  # 全局启用
    is_safe = Column(Boolean, default=True)  # 是否安全
    priority = Column(Integer, default=10)  # 优先级
    settings_schema = Column(JSON)  # 设置schema
    usage_count = Column(Integer, default=0)  # 使用次数统计
    last_used = Column(DateTime)  # 最后使用时间
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class PluginGroupSetting(Base):
    __tablename__ = "plugin_group_settings"

    id = Column(Integer, primary_key=True)
    plugin_name = Column(String(100), nullable=False)
    group_id = Column(String(20), nullable=False)
    is_enabled = Column(Boolean, default=True)  # 在群组中是否启用
    usage_count = Column(Integer, default=0)  # 群组内使用次数
    settings = Column(JSON, default=dict)  # 群组特定设置
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class PluginUsageLog(Base):
    __tablename__ = "plugin_usage_logs"

    id = Column(Integer, primary_key=True)
    plugin_name = Column(String(100), nullable=False)
    user_id = Column(String(20), nullable=False)
    group_id = Column(String(20))  # 可为空，表示私聊使用
    command = Column(String(200))  # 使用的命令
    result = Column(Text)  # 执行结果
    execution_time = Column(DateTime, default=datetime.now)
    success = Column(Boolean, default=True)  # 是否执行成功