"""
插件拦截器 - 基于真实数据库数据的插件拦截
"""
from nonebot import get_driver
from nonebot.message import event_preprocessor
from nonebot.adapters.onebot.v11 import GroupMessageEvent, PrivateMessageEvent, MessageEvent
from nonebot.matcher import Matcher
from nonebot.plugin import get_loaded_plugins
from modules.plugin.service import PluginService
from functools import wraps
from modules.log.service import LogService
import asyncio

class PluginInterceptor:
    def __init__(self):
        self.driver = get_driver()
        self.plugin_matcher_map = {}  # 插件到matcher的映射
        self.setup_interceptor()
        self.build_plugin_matcher_map()
        print("✅ 插件拦截器已初始化")

    def build_plugin_matcher_map(self):
        """构建插件到matcher的映射"""
        try:
            plugins = get_loaded_plugins()
            for plugin in plugins:
                plugin_name = plugin.name
                if hasattr(plugin, 'matcher'):
                    for matcher in plugin.matcher:
                        matcher_id = id(matcher)
                        self.plugin_matcher_map[matcher_id] = plugin_name
            print(f"📋 已映射 {len(self.plugin_matcher_map)} 个matcher到插件")
        except Exception as e:
            print(f"❌ 构建插件映射失败: {e}")

    def setup_interceptor(self):
        """设置插件拦截器"""

        @event_preprocessor
        async def intercept_plugins(event: MessageEvent):
            """拦截插件执行"""
            try:
                # 只处理消息事件
                if not isinstance(event, (GroupMessageEvent, PrivateMessageEvent)):
                    return

                # 获取群组ID（私聊时为None）
                group_id = str(event.group_id) if isinstance(event, GroupMessageEvent) else None
                user_id = str(event.user_id)

                # 获取所有禁用的插件
                disabled_plugins = await PluginService.get_disabled_plugins(group_id)
                if not disabled_plugins:
                    return  # 没有禁用的插件

                print(f"🔍 当前禁用插件: {disabled_plugins}")

                # 设置事件状态，供matcher检查使用
                setattr(event, '_disabled_plugins', disabled_plugins)
                setattr(event, '_current_group_id', group_id)

            except Exception as e:
                print(f"❌ 插件拦截预处理失败: {e}")

        # 添加matcher级别的拦截
        self.intercept_at_matcher_level()

    def intercept_at_matcher_level(self):
        """在matcher级别进行拦截"""
        try:
            from nonebot import on_message
            from nonebot.rule import Rule

            # 创建全局拦截matcher
            async def check_plugin_enabled(event: MessageEvent) -> bool:
                """检查插件是否启用"""
                try:
                    if not hasattr(event, '_disabled_plugins'):
                        return True

                    disabled_plugins = getattr(event, '_disabled_plugins', [])
                    if not disabled_plugins:
                        return True

                    # 获取当前matcher对应的插件名
                    import inspect
                    frame = inspect.currentframe()
                    while frame:
                        # 查找matcher对象
                        for var_name, var_value in frame.f_locals.items():
                            if isinstance(var_value, Matcher):
                                matcher_id = id(var_value)
                                plugin_name = self.plugin_matcher_map.get(matcher_id)
                                if plugin_name and plugin_name in disabled_plugins:
                                    print(f"🛑 拦截插件: {plugin_name} (matcher级别)")
                                    return False
                        frame = frame.f_back

                    return True

                except Exception as e:
                    print(f"❌ 检查插件启用状态失败: {e}")
                    return True

            # 创建拦截规则
            plugin_rule = Rule(check_plugin_enabled)

            # 创建全局拦截器
            global_interceptor = on_message(rule=plugin_rule, priority=1, block=False)

            @global_interceptor.handle()
            async def handle_global_intercept(event: MessageEvent):
                """全局拦截处理"""
                # 这里不做什么，只是让规则生效
                pass

        except Exception as e:
            print(f"❌ 设置matcher级别拦截失败: {e}")



# 全局实例
plugin_interceptor = PluginInterceptor()


def plugin_intercept(plugin_name: str):
    """插件拦截装饰器"""

    def decorator(func):
        @wraps(func)
        async def wrapper(event: MessageEvent, *args, **kwargs):
            # 检查插件是否启用
            group_id = str(event.group_id) if isinstance(event, GroupMessageEvent) else None
            is_enabled = await PluginService.is_plugin_enabled(plugin_name, group_id)

            if not is_enabled:
                print(f"🛑 插件 {plugin_name} 被拦截 (用户: {event.user_id}, 群组: {group_id})")
                return None  # 直接返回，不执行插件逻辑

            # 插件启用，正常执行
            return await func(event, *args, **kwargs)

        return wrapper

    return decorator