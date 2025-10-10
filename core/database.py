from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os
import asyncio

# 必须在导入任何模型之前创建Base
Base = declarative_base()

# 主数据库（现在包含所有表）
main_engine = None
main_async_session = None


async def init_database():
    """初始化数据库"""
    global main_engine, main_async_session

    try:
        # 确保数据目录存在
        os.makedirs('data', exist_ok=True)

        main_engine = create_async_engine(
            "sqlite+aiosqlite:///data/data.db",
            echo=False,  # 关闭 SQL 调试日志
            future=True
        )
        main_async_session = async_sessionmaker(
            main_engine, class_=AsyncSession, expire_on_commit=False
        )

        print("开始创建数据库表...")

        from modules.auth import models as auth_models

        from modules.user import models as user_models

        from modules.group import models as group_models

        from modules.plugin import models as plugin_models

        from modules.log import models as log_models

        from modules.system import models as system_models

        print("所有模型导入完成")

        async with main_engine.begin() as conn:
            print("创建所有数据库表...")
            await conn.run_sync(Base.metadata.create_all)
            print("✅ 所有数据库表创建完成")

        print("✅ 数据库初始化完成")

    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        import traceback
        traceback.print_exc()
        raise


async def close_database():
    """关闭数据库连接"""
    global main_engine

    try:
        if main_engine:
            await main_engine.dispose()
            print("✅ 数据库连接已关闭")
    except Exception as e:
        print(f"❌ 关闭数据库连接失败: {e}")


def get_db_session() -> AsyncSession:
    """获取数据库会话"""
    if main_async_session is None:
        raise RuntimeError("数据库未初始化")
    return main_async_session()


def get_log_session() -> AsyncSession:
    """获取日志数据库会话（现在与主数据库相同）"""
    return get_db_session()
