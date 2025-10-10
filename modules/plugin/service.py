from typing import List, Dict, Any, Optional
from sqlalchemy import select, and_
from .models import Plugin, PluginGroupSetting
from core.database import get_db_session


class PluginService:
    @staticmethod
    async def get_plugins(
            page: int = 1,
            page_size: int = 20,
            search: str = None,
            enabled: bool = None
    ) -> Dict[str, Any]:
        """获取插件列表 - 使用ORM"""
        async with get_db_session() as session:
            query = select(Plugin)

            if search:
                query = query.where(
                    Plugin.plugin_name.contains(search) |
                    Plugin.display_name.contains(search) |
                    Plugin.description.contains(search)
                )

            if enabled is not None:
                query = query.where(Plugin.is_global_enabled == enabled)

            from sqlalchemy import func
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar_one()

            query = query.order_by(Plugin.priority, Plugin.plugin_name)
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
                    "settings_schema": plugin.settings_schema,
                    "created_at": plugin.created_at,
                    "updated_at": plugin.updated_at
                } for plugin in plugins],
                "total": total,
                "page": page,
                "page_size": page_size
            }

    @staticmethod
    async def toggle_global_plugin(plugin_name: str, enabled: bool) -> bool:
        """切换插件全局状态 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(Plugin).where(Plugin.plugin_name == plugin_name)
            )
            plugin = result.scalar_one_or_none()

            if not plugin:
                return False

            plugin.is_global_enabled = enabled
            await session.commit()
            return True

    @staticmethod
    async def get_group_plugin_settings(plugin_name: str, group_id: str) -> Optional[PluginGroupSetting]:
        """获取群组插件设置 - 使用ORM"""
        async with get_db_session() as session:
            result = await session.execute(
                select(PluginGroupSetting).where(
                    and_(
                        PluginGroupSetting.plugin_name == plugin_name,
                        PluginGroupSetting.group_id == group_id
                    )
                )
            )
            return result.scalar_one_or_none()

    @staticmethod
    async def toggle_group_plugin(plugin_name: str, group_id: str, enabled: bool) -> bool:
        """切换群组插件状态 - 使用ORM"""
        async with get_db_session() as session:
            setting = await PluginService.get_group_plugin_settings(plugin_name, group_id)

            if not setting:
                setting = PluginGroupSetting(
                    plugin_name=plugin_name,
                    group_id=group_id,
                    is_enabled=enabled
                )
                session.add(setting)
            else:
                setting.is_enabled = enabled

            await session.commit()
            return True

    @staticmethod
    async def get_plugin_stats() -> Dict[str, Any]:
        """获取插件统计信息 - 使用ORM"""
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

            # 群组设置数
            group_settings_result = await session.execute(
                select(func.count(PluginGroupSetting.id))
            )
            group_settings = group_settings_result.scalar_one()

            return {
                "total_plugins": total_plugins,
                "enabled_plugins": enabled_plugins,
                "disabled_plugins": total_plugins - enabled_plugins,
                "group_settings": group_settings
            }