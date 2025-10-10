from nonebot import on_command
from nonebot.adapters.onebot.v11 import MessageEvent, MessageSegment
from nonebot.rule import to_me

echo = on_command("echo", rule=to_me(), aliases={"回声", "重复"}, priority=10)

@echo.handle()
async def handle_echo(event: MessageEvent):
    """回声命令处理器"""
    args = str(event.get_message()).strip()
    if args:
        await echo.finish(MessageSegment.text(args))
    else:
        await echo.finish(MessageSegment.text("请发送要回声的内容，例如：/echo 你好"))