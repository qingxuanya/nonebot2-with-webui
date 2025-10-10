import nonebot
from nonebot.adapters.onebot.v11 import Adapter as OneBotV11Adapter
from nonebot import get_driver
import asyncio
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from modules.log.service import LogService
from modules.system.service import SystemService
from datetime import datetime


class NoneBotManager:
    def __init__(self):
        self.current_config: Dict[str, Any] = {}
        self.is_running: bool = False
        self.nb_instance = None
        self.driver = None
        self.config_file = Path("config/bot_config.json")
        self._run_task = None
        self._stop_event = asyncio.Event()

    async def load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self.current_config = json.load(f)
            else:
                self.current_config = self._get_default_config()
                await self.save_config()

            return self.current_config
        except Exception as e:
            await LogService.add_system_log("ERROR", f"加载配置失败: {str(e)}")
            return self._get_default_config()

    async def save_config(self, config: Dict[str, Any] = None) -> bool:
        """保存配置文件"""
        try:
            if config:
                self.current_config.update(config)

            self.config_file.parent.mkdir(exist_ok=True)
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.current_config, f, indent=2, ensure_ascii=False)

            await LogService.add_system_log("INFO", "配置文件已保存")
            return True
        except Exception as e:
            await LogService.add_system_log("ERROR", f"保存配置失败: {str(e)}")
            return False

    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认配置"""
        return {
            "onebot": {
                "access_token": "",
                "secret": "",
                "ws_url": "ws://127.0.0.1:8080/onebot/v11/ws",
                "http_url": "http://127.0.0.1:5700"
            },
            "bot": {
                "superusers": [],
                "nickname": ["Bot"],
                "command_start": ["/", ""],
                "command_sep": ["."],
                "session_expire_timeout": 120
            },
            "webui": {
                "host": "0.0.0.0",
                "port": 8080,
                "secret_key": "your-secret-key-change-in-production"
            }
        }

    async def start_nonebot(self, config: Dict[str, Any] = None) -> bool:
        """启动NoneBot实例"""
        try:
            print("🚀 开始启动NoneBot...")

            if config:
                await self.save_config(config)
            else:
                await self.load_config()

            # 如果已经在运行，先关闭
            if self.is_running:
                print("⚠️ NoneBot已在运行，先关闭...")
                await self.shutdown_nonebot()
                await asyncio.sleep(2)

            # 设置环境变量
            onebot_config = self.current_config.get("onebot", {})
            if onebot_config.get("access_token"):
                os.environ["ONEBOT_ACCESS_TOKEN"] = onebot_config["access_token"]
            if onebot_config.get("secret"):
                os.environ["ONEBOT_SECRET"] = onebot_config["secret"]

            # 初始化NoneBot配置
            nonebot_config = {
                "driver": "~fastapi",
                "host": "0.0.0.0",
                "port": 8081,
                "onebot_access_token": onebot_config.get("access_token", ""),
                "onebot_secret": onebot_config.get("secret", ""),
                "superusers": self.current_config.get("bot", {}).get("superusers", []),
                "nickname": self.current_config.get("bot", {}).get("nickname", ["Bot"]),
                "command_start": self.current_config.get("bot", {}).get("command_start", ["/", ""]),
                "command_sep": self.current_config.get("bot", {}).get("command_sep", ["."]),
                "session_expire_timeout": self.current_config.get("bot", {}).get("session_expire_timeout", 120),
            }

            print("🔧 初始化NoneBot配置...")

            # 重置NoneBot状态
            await self._reset_nonebot_state()

            # 初始化NoneBot
            nonebot.init(**nonebot_config)

            # 注册适配器
            self.driver = nonebot.get_driver()
            self.driver.register_adapter(OneBotV11Adapter)

            # 加载内置插件
            nonebot.load_builtin_plugins()

            # 安全加载自定义插件
            await self._safe_load_plugins()

            self.nb_instance = nonebot
            self.is_running = True

            # 更新数据库状态
            start_time = datetime.now()
            await SystemService.update_bot_status(is_running=True, start_time=start_time)

            await LogService.add_system_log("INFO", f"NoneBot实例已启动 - {start_time}")

            # 启动NoneBot服务器
            self._run_task = asyncio.create_task(self._run_nonebot_simple())

            print("✅ NoneBot启动完成")
            return True

        except Exception as e:
            error_msg = f"启动NoneBot失败: {str(e)}"
            print(f"❌ {error_msg}")
            await LogService.add_system_log("ERROR", error_msg)
            return False

    async def _reset_nonebot_state(self):
        """安全重置NoneBot状态"""
        try:
            import nonebot

            # 只重置我们知道存在的属性，避免警告
            if hasattr(nonebot, '_config'):
                nonebot._config = None
            if hasattr(nonebot, '_driver'):
                nonebot._driver = None

            print("✅ NoneBot状态已重置")

        except Exception as e:
            print(f"⚠️ 重置NoneBot状态时出现警告: {e}")

    async def _safe_load_plugins(self):
        """安全加载插件 - 兼容旧版本"""
        try:
            plugins_dir = Path("plugins")
            if plugins_dir.exists() and plugins_dir.is_dir():
                print(f"📂 加载插件目录: {plugins_dir}")

                # 旧版本加载方式
                try:
                    # 尝试直接加载所有插件
                    nonebot.load_plugins("plugins")
                    print("✅ 插件加载完成")
                    await LogService.add_system_log("INFO", "插件加载完成", "nonebot")

                except Exception as e:
                    print(f"⚠️ 批量加载插件失败，尝试逐个加载: {str(e)}")
                    # 如果批量加载失败，尝试逐个加载
                    await self._load_plugins_one_by_one(plugins_dir)

            else:
                print("ℹ️ 未找到 plugins 目录，跳过插件加载")

        except Exception as e:
            error_msg = f"加载插件时出现错误: {str(e)}"
            print(f"⚠️ {error_msg}")
            await LogService.add_system_log("ERROR", error_msg, "nonebot")

    async def _load_plugins_one_by_one(self, plugins_dir: Path):
        """逐个加载插件，处理错误"""
        try:
            loaded_count = 0
            skipped_count = 0

            # 遍历插件目录
            for item in plugins_dir.iterdir():
                if item.is_dir() and (item / "__init__.py").exists():
                    plugin_name = item.name
                    try:
                        # 尝试加载单个插件
                        nonebot.load_plugin(f"plugins.{plugin_name}")
                        print(f"✅ 加载插件: {plugin_name}")
                        loaded_count += 1
                    except Exception as e:
                        print(f"⚠️ 跳过插件 {plugin_name}: {str(e)}")
                        await LogService.add_system_log("WARNING", f"跳过插件 {plugin_name}: {str(e)}", "nonebot")
                        skipped_count += 1

            print(f"📊 插件加载统计: 成功 {loaded_count} 个, 跳过 {skipped_count} 个")
            await LogService.add_system_log("INFO",
                                            f"插件加载完成: 成功 {loaded_count} 个, 跳过 {skipped_count} 个", "nonebot")

        except Exception as e:
            print(f"❌ 逐个加载插件失败: {str(e)}")
            raise

    async def _run_nonebot_simple(self):
        """运行NoneBot服务器"""
        try:
            print("🤖 NoneBot服务器正在运行...")

            # 获取驱动器和配置
            driver = nonebot.get_driver()
            config = driver.config

            host = str(getattr(config, "host", "0.0.0.0"))
            port = int(getattr(config, "port", 8081))

            print(f"🌐 NoneBot服务器运行在 {host}:{port}")

            # 简单的保持运行循环
            while self.is_running and not self._stop_event.is_set():
                await asyncio.sleep(1)

            print("⏹️ NoneBot服务器停止运行")

        except asyncio.CancelledError:
            print("⏹️ NoneBot服务器任务被取消")
        except Exception as e:
            error_msg = f"NoneBot服务器运行异常: {str(e)}"
            print(f"❌ {error_msg}")
            await LogService.add_system_log("ERROR", error_msg, "nonebot")
        finally:
            # 更新状态
            self.is_running = False
            stop_time = datetime.now()
            await SystemService.update_bot_status(is_running=False, last_restart=stop_time)

    async def shutdown_nonebot(self) -> bool:
        """关闭NoneBot实例"""
        try:
            if self.is_running:
                print("🛑 正在关闭NoneBot实例...")

                # 设置停止事件
                self._stop_event.set()

                # 取消运行任务
                if self._run_task and not self._run_task.done():
                    self._run_task.cancel()
                    try:
                        await asyncio.wait_for(self._run_task, timeout=5.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        print("✅ 运行任务已取消")

                # 关闭驱动器
                if self.driver:
                    try:
                        await self.driver.shutdown()
                        print("✅ NoneBot驱动器已关闭")
                    except Exception as e:
                        print(f"⚠️ 关闭驱动器时出错: {e}")

                # 重置状态
                self.is_running = False
                self.driver = None
                self.nb_instance = None
                self._run_task = None
                self._stop_event.clear()

                # 更新数据库状态
                stop_time = datetime.now()
                await SystemService.update_bot_status(is_running=False, last_restart=stop_time)

                await LogService.add_system_log("INFO", f"NoneBot实例已关闭 - {stop_time}")
                print("✅ NoneBot实例关闭完成")
                return True

            print("ℹ️ NoneBot实例未运行，无需关闭")
            return True

        except Exception as e:
            error_msg = f"关闭NoneBot失败: {str(e)}"
            print(f"❌ {error_msg}")
            await LogService.add_system_log("ERROR", error_msg)
            return False

    async def restart_nonebot(self, new_config: Dict[str, Any] = None) -> bool:
        """重启NoneBot实例"""
        try:
            print("🔄 正在重启NoneBot实例...")
            await self.shutdown_nonebot()
            await asyncio.sleep(2)
            success = await self.start_nonebot(new_config)
            if success:
                print("✅ NoneBot实例重启成功")
            else:
                print("❌ NoneBot实例重启失败")
            return success
        except Exception as e:
            error_msg = f"重启NoneBot失败: {str(e)}"
            print(f"❌ {error_msg}")
            await LogService.add_system_log("ERROR", error_msg)
            return False

    def get_status(self) -> Dict[str, Any]:
        """获取运行状态"""
        return {
            "is_running": self.is_running,
            "config": self.current_config,
            "adapters": ["OneBot V11"] if self.is_running else []
        }


# 全局实例
nonebot_manager = NoneBotManager()