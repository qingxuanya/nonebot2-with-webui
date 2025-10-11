from typing import List, Dict, Any, Optional
from sqlalchemy import select, and_, func
from .models import Plugin, PluginGroupSetting, PluginUsageLog
from core.database import get_db_session
from datetime import datetime


class PluginService:
    @staticmethod
    async def register_plugin(plugin_info: Dict[str, Any]) -> bool:
        """注册或更新插件信息"""
        async with get_db_session() as session:
            try:
                result = await session.execute(
                    select(Plugin).where(Plugin.plugin_name == plugin_info["plugin_name"])
                )
                plugin = result.scalar_one_or_none()

                if plugin:
                    # 更新现有插件
                    for key, value in plugin_info.items():
                        if hasattr(plugin, key):
                            setattr(plugin, key, value)
                    plugin.updated_at = datetime.now()
                else:
                    # 创建新插件
                    plugin = Plugin(**plugin_info)
                    session.add(plugin)

                await session.commit()
                print(f"✅ 插件注册成功: {plugin_info['plugin_name']}")
                return True
            except Exception as e:
                print(f"❌ 插件注册失败 {plugin_info['plugin_name']}: {e}")
                await session.rollback()
                return False

    @staticmethod
    async def record_plugin_usage(
            plugin_name: str,
            user_id: str,
            group_id: str = None,
            command: str = None,
            result: str = None,
            success: bool = True
    ):
        """记录插件使用情况"""
        async with get_db_session() as session:
            try:
                # 记录使用日志
                usage_log = PluginUsageLog(
                    plugin_name=plugin_name,
                    user_id=user_id,
                    group_id=group_id,
                    command=command,
                    result=result,
                    success=success
                )
                session.add(usage_log)

                # 更新插件使用统计
                plugin_result = await session.execute(
                    select(Plugin).where(Plugin.plugin_name == plugin_name)
                )
                plugin = plugin_result.scalar_one_or_none()

                if plugin:
                    plugin.usage_count += 1
                    plugin.last_used = datetime.now()

                # 更新群组插件使用统计
                if group_id:
                    group_setting_result = await session.execute(
                        select(PluginGroupSetting).where(
                            and_(
                                PluginGroupSetting.plugin_name == plugin_name,
                                PluginGroupSetting.group_id == group_id
                            )
                        )
                    )
                    group_setting = group_setting_result.scalar_one_or_none()

                    if group_setting:
                        group_setting.usage_count += 1

                await session.commit()
                print(f"📊 记录插件使用: {plugin_name} by {user_id}")
            except Exception as e:
                print(f"❌ 记录插件使用失败: {e}")
                await session.rollback()

    @staticmethod
    async def get_plugin_stats() -> Dict[str, Any]:
        """获取插件统计信息"""
        async with get_db_session() as session:
            from sqlalchemy import func

            # 总插件数
            total_result = await session.execute(select(func.count(Plugin.id)))
            total_plugins = total_result.scalar_one()

            # 启用插件数
            enabled_result = await session.execute(
                select(func.count(Plugin.id)).where(Plugin.is_global_enabled == True)
            )
            enabled_plugins = enabled_result.scalar_one()

            # 总使用次数
            total_usage_result = await session.execute(select(func.sum(Plugin.usage_count)))
            total_usage = total_usage_result.scalar_one() or 0

            # 今日使用次数
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_usage_result = await session.execute(
                select(func.count(PluginUsageLog.id)).where(PluginUsageLog.execution_time >= today_start)
            )
            today_usage = today_usage_result.scalar_one()

            # 最常用插件
            popular_plugin_result = await session.execute(
                select(Plugin.plugin_name, Plugin.usage_count)
                .order_by(Plugin.usage_count.desc())
                .limit(5)
            )
            popular_plugins = [
                {"name": name, "usage_count": count}
                for name, count in popular_plugin_result.all()
            ]

            return {
                "total_plugins": total_plugins,
                "enabled_plugins": enabled_plugins,
                "disabled_plugins": total_plugins - enabled_plugins,
                "total_usage": total_usage,
                "today_usage": today_usage,
                "popular_plugins": popular_plugins,
                "group_settings": await PluginService.get_group_settings_count()
            }

    @staticmethod
    async def get_group_settings_count() -> int:
        """获取群组设置数量"""
        async with get_db_session() as session:
            from sqlalchemy import func
            result = await session.execute(select(func.count(PluginGroupSetting.id)))
            return result.scalar_one()

    @staticmethod
    async def get_plugins(
            page: int = 1,
            page_size: int = 20,
            search: str = None,
            enabled: bool = None
    ) -> Dict[str, Any]:
        """获取插件列表 - 使用ORM"""
        async with get_db_session() as session:
            # 基础查询
            query = select(Plugin)

            # 搜索条件
            if search:
                query = query.where(
                    Plugin.plugin_name.contains(search) |
                    Plugin.display_name.contains(search) |
                    Plugin.description.contains(search)
                )

            if enabled is not None:
                query = query.where(Plugin.is_global_enabled == enabled)

            # 总数
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            # 分页数据
            query = query.order_by(Plugin.priority.asc(), Plugin.plugin_name.asc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await session.execute(query)
            plugins = result.scalars().all()

            return {
                "plugins": [{
                    "id": plugin.id,
                    "plugin_name": plugin.plugin_name,
                    "plugin_module": plugin.plugin_module,
                    "display_name": plugin.display_name,
                    "description": plugin.description,
                    "version": plugin.version,
                    "author": plugin.author,
                    "is_global_enabled": plugin.is_global_enabled,
                    "is_safe": plugin.is_safe,
                    "priority": plugin.priority,
                    "usage_count": plugin.usage_count,
                    "last_used": plugin.last_used,
                    "created_at": plugin.created_at,
                    "updated_at": plugin.updated_at
                } for plugin in plugins],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }

    @staticmethod
    async def toggle_global_plugin(plugin_name: str, enabled: bool) -> bool:
        """切换插件全局启用状态"""
        async with get_db_session() as session:
            try:
                result = await session.execute(
                    select(Plugin).where(Plugin.plugin_name == plugin_name)
                )
                plugin = result.scalar_one_or_none()

                if not plugin:
                    return False

                plugin.is_global_enabled = enabled
                plugin.updated_at = datetime.now()
                await session.commit()
                return True
            except Exception as e:
                print(f"切换插件状态失败: {e}")
                await session.rollback()
                return False

    @staticmethod
    async def toggle_group_plugin(plugin_name: str, group_id: str, enabled: bool) -> bool:
        """切换群组插件启用状态"""
        async with get_db_session() as session:
            try:
                result = await session.execute(
                    select(PluginGroupSetting).where(
                        and_(
                            PluginGroupSetting.plugin_name == plugin_name,
                            PluginGroupSetting.group_id == group_id
                        )
                    )
                )
                group_setting = result.scalar_one_or_none()

                if group_setting:
                    group_setting.is_enabled = enabled
                    group_setting.updated_at = datetime.now()
                else:
                    group_setting = PluginGroupSetting(
                        plugin_name=plugin_name,
                        group_id=group_id,
                        is_enabled=enabled
                    )
                    session.add(group_setting)

                await session.commit()
                return True
            except Exception as e:
                print(f"切换群组插件状态失败: {e}")
                await session.rollback()
                return False

    @staticmethod
    async def get_group_plugin_settings(group_id: str) -> List[Dict[str, Any]]:
        """获取群组插件设置"""
        async with get_db_session() as session:
            try:
                result = await session.execute(
                    select(PluginGroupSetting).where(PluginGroupSetting.group_id == group_id)
                )
                settings = result.scalars().all()

                return [{
                    "plugin_name": setting.plugin_name,
                    "group_id": setting.group_id,
                    "is_enabled": setting.is_enabled,
                    "usage_count": setting.usage_count,
                    "settings": setting.settings
                } for setting in settings]
            except Exception as e:
                print(f"获取群组插件设置失败: {e}")
                return []

    @staticmethod
    async def get_group_enabled_plugins(group_id: str) -> List[str]:
        """获取群组启用的插件列表"""
        async with get_db_session() as session:
            try:
                result = await session.execute(
                    select(PluginGroupSetting.plugin_name).where(
                        and_(
                            PluginGroupSetting.group_id == group_id,
                            PluginGroupSetting.is_enabled == True
                        )
                    )
                )
                return [row[0] for row in result.all()]
            except Exception as e:
                print(f"获取群组启用插件失败: {e}")
                return []

    @staticmethod
    async def is_plugin_enabled(plugin_name: str, group_id: str = None) -> bool:
        """检查插件是否启用"""
        async with get_db_session() as session:
            try:
                # 首先检查插件是否存在
                plugin_result = await session.execute(
                    select(Plugin).where(Plugin.plugin_name == plugin_name)
                )
                plugin = plugin_result.scalar_one_or_none()

                if not plugin:
                    return False  # 插件不存在

                # 检查全局启用状态
                if not plugin.is_global_enabled:
                    return False  # 全局禁用

                # 如果有群组ID，检查群组特定设置
                if group_id:
                    group_setting_result = await session.execute(
                        select(PluginGroupSetting).where(
                            and_(
                                PluginGroupSetting.plugin_name == plugin_name,
                                PluginGroupSetting.group_id == group_id
                            )
                        )
                    )
                    group_setting = group_setting_result.scalar_one_or_none()

                    if group_setting:
                        return group_setting.is_enabled  # 返回群组特定设置
                    else:
                        # 如果没有群组特定设置，使用全局设置
                        return plugin.is_global_enabled

                return plugin.is_global_enabled

            except Exception as e:
                print(f"❌ 检查插件状态失败: {e}")
                return False  # 出错时默认禁用

    @staticmethod
    async def get_disabled_plugins(group_id: str = None) -> List[str]:
        """获取禁用的插件列表"""
        async with get_db_session() as session:
            try:
                disabled_plugins = []

                # 获取全局禁用的插件
                global_disabled_result = await session.execute(
                    select(Plugin.plugin_name).where(Plugin.is_global_enabled == False)
                )
                global_disabled = [row[0] for row in global_disabled_result.all()]
                disabled_plugins.extend(global_disabled)

                # 如果有群组ID，获取群组禁用的插件
                if group_id:
                    group_disabled_result = await session.execute(
                        select(PluginGroupSetting.plugin_name).where(
                            and_(
                                PluginGroupSetting.group_id == group_id,
                                PluginGroupSetting.is_enabled == False
                            )
                        )
                    )
                    group_disabled = [row[0] for row in group_disabled_result.all()]
                    disabled_plugins.extend(group_disabled)

                return list(set(disabled_plugins))  # 去重

            except Exception as e:
                print(f"❌ 获取禁用插件列表失败: {e}")
                return []