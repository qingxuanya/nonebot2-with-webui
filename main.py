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
    # 创建FastAPI应用
    app = create_application()

    # 初始化数据库
    await init_database()

    # 注册模块
    await register_modules(app)

    # 注册Web路由
    register_web_routes(app)

    return app


async def initialize_nonebot():
    """初始化NoneBot实例"""
    try:
        # 确保数据库已经完全初始化
        await asyncio.sleep(1)

        # 加载默认配置初始化NoneBot
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
        # 设置Web应用和数据库
        app = await setup_application()

        # 等待数据库完全就绪后再启动NoneBot
        await asyncio.sleep(2)

        # 初始化NoneBot
        await initialize_nonebot()

        # 配置信号处理
        shutdown_event = asyncio.Event()

        def signal_handler(signum, frame):
            print(f"\n接收到信号 {signum}，正在关闭...")
            shutdown_event.set()

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
        print("访问地址: http://127.0.0.1:8080")
        print("默认管理员账户: admin / admin123")
        print("按 Ctrl+C 退出")
        print("=" * 50)

        # 创建服务器任务
        server_task = asyncio.create_task(server.serve())

        try:
            # 等待关闭事件或服务器完成
            await asyncio.wait_for(shutdown_event.wait(), timeout=None)

            print("🛑 正在关闭服务器...")

            # 优雅关闭NoneBot
            if nonebot_manager.is_running:
                print("🛑 正在关闭NoneBot实例...")
                await nonebot_manager.shutdown_nonebot()

            # 关闭服务器
            server.should_exit = True
            if not server_task.done():
                server_task.cancel()
                try:
                    await asyncio.wait_for(server_task, timeout=5.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass

        except asyncio.CancelledError:
            print("⏹️ 服务器任务被取消")
        except Exception as e:
            print(f"关闭过程中出错: {e}")

    except Exception as e:
        print(f"启动失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 清理资源
        print("🧹 清理资源...")
        await close_database()
        print("✅ 程序已退出")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n程序已被用户中断")
    except Exception as e:
        print(f"程序异常: {e}")
        import traceback

        traceback.print_exc()