#!/usr/bin/env python3
"""
NoneBot WebUI管理系统启动脚本
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def main():
    try:
        from main import main as app_main
        await app_main()
    except ImportError as e:
        print(f"导入错误: {e}")
        print("请确保已安装所有依赖: pip install -r requirements.txt")
    except KeyboardInterrupt:
        print("\n程序已被用户中断")
    except Exception as e:
        print(f"启动失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("=" * 50)
    print("NoneBot WebUI管理系统")
    print("=" * 50)

    # 检查依赖
    try:
        import nonebot
        import fastapi
        import sqlalchemy

        print("✓ 依赖检查通过")
    except ImportError as e:
        print(f"✗ 依赖缺失: {e}")
        print("请运行: pip install -r requirements.txt")
        sys.exit(1)

    # 启动应用
    asyncio.run(main())
