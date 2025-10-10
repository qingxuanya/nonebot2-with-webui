import nonebot
from nonebot.adapters.onebot.v11 import Adapter as OneBotV11Adapter
from fastapi import FastAPI
import uvicorn
import asyncio
from core.application import create_application
from core.database import init_database, close_database
from modules import register_modules
from web.routes import register_web_routes
from core.nonebot_manager import nonebot_manager
import signal
import sys


async def setup_application():
    """设置应用程序"""
    app = create_application()
    await init_database()
    await register_modules(app)
    register_web_routes(app)

    return app


async def initialize_nonebot():
    """初始化NoneBot实例"""
    try:
        await asyncio.sleep(1)

        await nonebot_manager.load_config()
        success = await nonebot_manager.start_nonebot()
        if success:
            print("✅ NoneBot实例初始化成功")
        else:
            print("❌ NoneBot实例初始化失败")
    except Exception as e:
        print(f"❌ NoneBot初始化失败: {e}")


async def main():
    """主程序入口"""
    print("正在启动NoneBot WebUI管理系统...")

    try:
        app = await setup_application()

        await asyncio.sleep(2)

        await initialize_nonebot()

        def signal_handler(signum, frame):
            print(f"\n接收到信号 {signum}，正在关闭...")
            asyncio.create_task(nonebot_manager.shutdown_nonebot())
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # 启动FastAPI服务器 - 静默模式
        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=8080,
            log_level="warning",  # 只显示警告和错误
            access_log=False  # 关闭访问日志
        )
        server = uvicorn.Server(config)

        print("=" * 50)
        print("WebUI管理系统启动成功!")
        print("访问地址: http://localhost:8080/web_ui")
        print("默认管理员账户: admin / admin123")
        print("按 Ctrl+C 退出")
        print("=" * 50)

        await server.serve()

    except Exception as e:
        print(f"启动失败: {e}")
    finally:
        await close_database()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n程序已退出")
    except Exception as e:
        print(f"程序异常: {e}")
