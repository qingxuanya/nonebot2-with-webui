"""
Echo 插件 - 复读用户消息并记录使用统计
"""
from nonebot import on_message
from nonebot.adapters.onebot.v11 import MessageEvent, Message, GroupMessageEvent
from nonebot.params import CommandArg
from nonebot.plugin import PluginMetadata, on_command
from nonebot.rule import to_me
from core.plugin_interceptor import plugin_intercept

# 新版插件元数据
__plugin_meta__ = PluginMetadata(
    name="复读插件",
    description="一个简单的复读插件，可以复读用户的消息并记录使用统计",
    usage="直接发送消息即可触发复读",
    type="application",
    homepage="https://github.com/your-repo",
    supported_adapters={"~onebot.v11"},
    extra={
        "version": "1.0.0",
        "author": "System",
        "plugin_name": "echo",
        "plugin_module": "plugins.echo",
        "is_global_enabled": True,
        "is_safe": True,
        "priority": 5,
        "settings_schema": {
            "max_length": {
                "type": "number",
                "default": 100,
                "description": "最大复读长度"
            },
            "allow_private": {
                "type": "boolean",
                "default": True,
                "description": "允许私聊使用"
            },
            "enable_smart_echo": {
                "type": "boolean",
                "default": True,
                "description": "启用智能复读"
            }
        }
    }
)

from modules.plugin.service import PluginService

# 创建消息处理器
echo_matcher = on_command("echo", to_me())


@echo_matcher.handle()
@plugin_intercept("echo")
async def handle_echo(event: MessageEvent, message: Message = CommandArg()):
    """处理echo命令"""
    if any((not seg.is_text()) or str(seg) for seg in message):
        await echo_matcher.send(message=message)

        group_id = str(event.group_id) if isinstance(event, GroupMessageEvent) else None
        await PluginService.record_plugin_usage(
            plugin_name="echo",
            user_id=str(event.user_id),
            group_id=group_id,
            command="echo",
            result="success",
            success=True
        )
