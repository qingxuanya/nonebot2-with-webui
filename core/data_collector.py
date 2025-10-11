"""
数据收集服务 - 将NoneBot事件保存到数据库
"""
from nonebot import get_driver
from nonebot.plugin import on
from nonebot.adapters.onebot.v11 import (
    GroupMessageEvent, PrivateMessageEvent,
    GroupIncreaseNoticeEvent, GroupDecreaseNoticeEvent,
    MessageEvent, Bot, Event
)
from modules.log.service import LogService
from modules.user.service import UserService
from modules.group.service import GroupService
from datetime import datetime
import asyncio

class DataCollector:
    def __init__(self):
        self.driver = get_driver()
        self.setup_handlers()
        print("✅ 数据收集服务已初始化")

    def setup_handlers(self):
        """设置事件处理器"""

        # 机器人连接事件 - 只记录，不主动调用API
        @self.driver.on_bot_connect
        async def handle_bot_connect(bot: Bot):
            print("🤖 机器人已连接，等待消息事件触发数据注册...")
            # 记录系统日志
            await LogService.add_system_log(
                "INFO",
                "机器人连接成功，数据收集服务就绪",
                "data_collector"
            )

        # 创建消息匹配器
        message_matcher = on(type="message", priority=1, block=False)
        notice_matcher = on(type="notice", priority=1, block=False)

        # 群组消息处理器 - 这是主要的注册触发点
        @message_matcher.handle()
        async def handle_group_message(event: GroupMessageEvent):
            try:
                await self.handle_group_message(event)
            except Exception as e:
                print(f"❌ 处理群组消息失败: {e}")

        # 私聊消息处理器
        @message_matcher.handle()
        async def handle_private_message(event: PrivateMessageEvent):
            try:
                await self.handle_private_message(event)
            except Exception as e:
                print(f"❌ 处理私聊消息失败: {e}")

        # 群成员增加事件
        @notice_matcher.handle()
        async def handle_group_increase(event: GroupIncreaseNoticeEvent):
            try:
                await self.handle_group_member_increase(event)
            except Exception as e:
                print(f"❌ 处理群成员增加事件失败: {e}")

        # 群成员减少事件
        @notice_matcher.handle()
        async def handle_group_decrease(event: GroupDecreaseNoticeEvent):
            try:
                await self.handle_group_member_decrease(event)
            except Exception as e:
                print(f"❌ 处理群成员减少事件失败: {e}")

    async def handle_group_member_increase(self, event: GroupIncreaseNoticeEvent):
        """处理群成员增加"""
        try:
            user_id = str(event.user_id)
            group_id = str(event.group_id)

            print(f"👥 群成员增加: {user_id} 加入群 {group_id}")

            # 立即注册用户和群组成员信息
            await self.register_user_and_group_member(group_id, user_id, "新成员")

            # 记录系统日志
            await LogService.add_system_log(
                "INFO",
                f"用户 {user_id} 加入群 {group_id}",
                "data_collector"
            )

        except Exception as e:
            print(f"❌ 处理群成员增加失败: {e}")

    async def handle_group_member_decrease(self, event: GroupDecreaseNoticeEvent):
        """处理群成员减少"""
        try:
            user_id = str(event.user_id)
            group_id = str(event.group_id)

            print(f"👋 成员离开: 用户{user_id} 离开群 {group_id}")

            # 记录系统日志
            await LogService.add_system_log(
                "INFO",
                f"用户 {user_id} 离开群 {group_id}",
                "data_collector"
            )

        except Exception as e:
            print(f"❌ 处理群成员减少失败: {e}")

    async def handle_group_message(self, event: GroupMessageEvent):
        """处理群组消息 - 这是主要的注册逻辑"""
        try:
            group_id = str(event.group_id)
            user_id = str(event.user_id)

            print(f"💬 处理群组消息: 群{group_id} 用户{user_id}")

            # 1. 首先确保群组存在
            await self.ensure_group_exists(group_id, event)

            # 2. 确保用户存在
            await self.ensure_user_exists(user_id, event)

            # 3. 确保群组成员关系存在
            await self.ensure_group_member_exists(group_id, user_id, event)

            # 4. 保存消息日志
            success = await LogService.add_message_log(
                group_id=group_id,
                user_id=user_id,
                user_name=event.sender.card or event.sender.nickname or f"用户{user_id}",
                message_type="group",
                message_content=str(event.message),
                raw_message=event.raw_message
            )

            if success:
                print("✅ 消息日志保存成功")
            else:
                print("❌ 消息日志保存失败")

            # 5. 更新最后活动时间
            await self.update_last_activity(group_id, user_id, event)

            print(f"✅ 群组消息处理完成: 用户{user_id} 在群{group_id}")

        except Exception as e:
            print(f"❌ 处理群组消息失败: {e}")
            import traceback
            traceback.print_exc()

    async def ensure_group_exists(self, group_id: str, event: GroupMessageEvent):
        """确保群组存在"""
        try:
            from modules.group.service import GroupService

            # 检查群组是否已存在
            existing_group = await GroupService.get_group(group_id)
            if not existing_group:
                # 群组不存在，创建新群组
                group_name = event.sender.card or f"群{group_id}"
                await GroupService.update_group_info(
                    group_id=group_id,
                    group_name=group_name,
                    last_active=datetime.now()
                )
                print(f"✅ 创建新群组: {group_name}({group_id})")

                # 记录系统日志
                await LogService.add_system_log(
                    "INFO",
                    f"创建新群组: {group_name}({group_id})",
                    "data_collector"
                )
            else:
                # 群组已存在，更新最后活动时间
                await GroupService.update_group_info(
                    group_id=group_id,
                    last_active=datetime.now()
                )

        except Exception as e:
            print(f"❌ 确保群组存在失败: {e}")
            raise

    async def ensure_user_exists(self, user_id: str, event: GroupMessageEvent):
        """确保用户存在"""
        try:
            from modules.user.service import UserService

            # 检查用户是否已存在
            user_detail = await UserService.get_user_detail(user_id)
            if not user_detail:
                # 用户不存在，创建新用户
                username = event.sender.nickname or f"用户{user_id}"
                nickname = event.sender.card or ""

                await UserService.update_user_profile(
                    user_id=user_id,
                    username=username,
                    nickname=nickname,
                    last_active=datetime.now()
                )
                print(f"✅ 创建新用户: {username}({user_id})")

                # 记录系统日志
                await LogService.add_system_log(
                    "INFO",
                    f"创建新用户: {username}({user_id})",
                    "data_collector"
                )
            else:
                # 用户已存在，更新最后活动时间
                await UserService.update_user_profile(
                    user_id=user_id,
                    last_active=datetime.now()
                )

        except Exception as e:
            print(f"❌ 确保用户存在失败: {e}")
            raise

    async def ensure_group_member_exists(self, group_id: str, user_id: str, event: GroupMessageEvent):
        """确保群组成员关系存在"""
        try:
            from modules.group.service import GroupService

            # 检查群组成员是否已存在
            group_users = await GroupService.get_group_users(group_id, page_size=1000)
            existing_member = None

            if group_users and 'users' in group_users:
                for user in group_users['users']:
                    if user['user_id'] == user_id:
                        existing_member = user
                        break

            if not existing_member:
                # 群组成员不存在，创建新成员
                user_name = event.sender.nickname or f"用户{user_id}"
                user_card = event.sender.card or ""

                await GroupService.update_group_user(
                    group_id=group_id,
                    user_id=user_id,
                    user_name=user_name,
                    user_card=user_card,
                    join_time=datetime.now(),
                    last_speak=datetime.now(),
                    message_count=1  # 第一条消息
                )
                print(f"✅ 创建新群组成员: {user_name}({user_id}) 在群 {group_id}")

                # 记录系统日志
                await LogService.add_system_log(
                    "INFO",
                    f"创建新群组成员: {user_name}({user_id}) 在群 {group_id}",
                    "data_collector"
                )
            else:
                # 群组成员已存在，更新最后发言时间和消息计数
                await GroupService.update_group_user(
                    group_id=group_id,
                    user_id=user_id,
                    last_speak=datetime.now()
                )
                # 注意：message_count 会在 GroupService 中自动增加

        except Exception as e:
            print(f"❌ 确保群组成员存在失败: {e}")
            raise

    async def update_last_activity(self, group_id: str, user_id: str, event: GroupMessageEvent):
        """更新最后活动时间"""
        try:
            # 更新群组最后活动时间
            from modules.group.service import GroupService
            await GroupService.update_group_info(
                group_id=group_id,
                last_active=datetime.now()
            )

            # 更新用户最后活动时间
            from modules.user.service import UserService
            await UserService.update_user_profile(
                user_id=user_id,
                last_active=datetime.now()
            )

            print(f"✅ 更新活动时间: 群{group_id} 用户{user_id}")

        except Exception as e:
            print(f"❌ 更新活动时间失败: {e}")

    async def register_user_and_group_member(self, group_id: str, user_id: str, default_name: str = None):
        """注册用户和群组成员（用于成员加入事件）"""
        try:
            # 确保群组存在
            from modules.group.service import GroupService
            existing_group = await GroupService.get_group(group_id)
            if not existing_group:
                await GroupService.update_group_info(
                    group_id=group_id,
                    group_name=f"群{group_id}",
                    last_active=datetime.now()
                )
                print(f"✅ 自动创建群组: {group_id}")

            # 确保用户存在
            from modules.user.service import UserService
            user_detail = await UserService.get_user_detail(user_id)
            if not user_detail:
                user_name = default_name or f"用户{user_id}"
                await UserService.update_user_profile(
                    user_id=user_id,
                    username=user_name,
                    last_active=datetime.now()
                )
                print(f"✅ 自动创建用户: {user_name}({user_id})")

            # 确保群组成员关系存在
            group_users = await GroupService.get_group_users(group_id, page_size=1000)
            existing_member = None

            if group_users and 'users' in group_users:
                for user in group_users['users']:
                    if user['user_id'] == user_id:
                        existing_member = user
                        break

            if not existing_member:
                user_name = default_name or f"用户{user_id}"
                await GroupService.update_group_user(
                    group_id=group_id,
                    user_id=user_id,
                    user_name=user_name,
                    join_time=datetime.now(),
                    last_speak=datetime.now(),
                    message_count=0
                )
                print(f"✅ 自动创建群组成员: {user_name}({user_id}) 在群 {group_id}")

        except Exception as e:
            print(f"❌ 注册用户和群组成员失败: {e}")

    async def handle_private_message(self, event: PrivateMessageEvent):
        """处理私聊消息"""
        try:
            user_id = str(event.user_id)

            print(f"💬 处理私聊消息: 用户{user_id}")

            # 确保用户存在
            from modules.user.service import UserService
            user_detail = await UserService.get_user_detail(user_id)
            if not user_detail:
                username = event.sender.nickname or f"用户{user_id}"
                await UserService.update_user_profile(
                    user_id=user_id,
                    username=username,
                    last_active=datetime.now()
                )
                print(f"✅ 私聊创建新用户: {username}({user_id})")

            # 保存消息日志
            success = await LogService.add_message_log(
                group_id="private",
                user_id=user_id,
                user_name=event.sender.nickname or f"用户{user_id}",
                message_type="private",
                message_content=str(event.message),
                raw_message=event.raw_message
            )

            if success:
                print("✅ 私聊消息日志保存成功")
            else:
                print("❌ 私聊消息日志保存失败")

            # 更新用户最后活动时间
            await UserService.update_user_profile(
                user_id=user_id,
                last_active=datetime.now()
            )

            print(f"✅ 私聊消息处理完成: 用户{user_id}")

        except Exception as e:
            print(f"❌ 处理私聊消息失败: {e}")
            import traceback
            traceback.print_exc()

# 全局实例
data_collector = DataCollector()