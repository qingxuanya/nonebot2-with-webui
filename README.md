
### 项目简介

这是一个 NoneBot2 Web 管理系统,提供了完整的可视化管理后台 nonebot2-with-webui:11-14 。系统采用 FastAPI 作为 Web 框架,支持通过浏览器管理 NoneBot 机器人实例<cite/>。

### 核心特性

根据架构文档,项目包含以下核心功能模块:
- **认证系统** (auth module): 用户登录和权限管理<cite/>
- **群组管理** (group module): 机器人群组配置<cite/>
- **日志系统** (log module): 系统日志记录<cite/>
- **插件管理** (plugin module): 插件加载和配置<cite/>
- **系统管理** (system module): 机器人启停控制<cite/>

### 技术栈

- **Web 框架**: FastAPI nonebot2-with-webui:1-1 
- **机器人框架**: NoneBot2 + OneBotV11 适配器 nonebot2-with-webui:1-2 
- **数据库**: SQLite (通过 SQLAlchemy 异步 ORM) nonebot2-with-webui:39-39 
- **模板引擎**: Jinja2 nonebot2-with-webui:34-34 

### 安装依赖

```bash
pip install -r requirements.txt
``` nonebot2-with-webui:21-21 

### 启动方式

使用提供的启动脚本:
```bash
python start.py
``` nonebot2-with-webui:1-4 

或直接运行主程序:
```bash
python main.py
``` nonebot2-with-webui:17-17 

### 项目结构

```
├── core/              # 核心基础设施
│   ├── application.py # FastAPI 应用工厂
│   ├── database.py    # 数据库管理
│   └── nonebot_manager.py # NoneBot 生命周期管理
├── modules/           # 业务逻辑模块
├── web/              # Web 界面
│   ├── routes.py     # 路由注册
│   └── templates/    # 页面模板
├── theme/static/     # 静态资源
├── config/           # 配置文件
├── data/             # 数据存储
├── plugins/          # NoneBot 插件
├── main.py           # 主入口
└── start.py          # 启动脚本
``` nonebot2-with-webui:27-29 nonebot2-with-webui:32-33 

### 访问地址

启动后默认访问地址为 `http://localhost:8080`<cite/>

### 依赖检查

启动脚本会自动检查必要的依赖包 (nonebot, fastapi, sqlalchemy) nonebot2-with-webui:36-45 

## Notes

项目采用了清晰的分层架构,将 Web 管理界面和 NoneBot 机器人运行时分离<cite/>。系统通过 `nonebot_manager` 单例管理机器人的生命周期,支持启动、停止和重启操作<cite/>。所有模块都使用异步数据库会话进行数据持久化<cite/>。启动脚本 `start.py` 提供了友好的错误处理和依赖检查 nonebot2-with-webui:14-27 。

Wiki pages you might want to explore:
- [Core Architecture (qingxuanya/nonebot2-with-webui)](/wiki/qingxuanya/nonebot2-with-webui#3)


### Citations


**File:** core/application.py (L1-1)

```python
from fastapi import FastAPI
```

**File:** core/application.py (L11-14)

```python
    app = FastAPI(
        title="NoneBot WebUI管理系统",
        description="完整的NoneBot管理后台",
        version="1.0.0"
```

**File:** core/application.py (L27-29)

```python
    theme_path = Path("theme/static")
    theme_path.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=theme_path), name="static")
```

**File:** core/application.py (L32-33)

```python
    templates_path = Path("web/templates")
    templates_path.mkdir(parents=True, exist_ok=True)
```

**File:** core/application.py (L34-34)

```python
    templates = Jinja2Templates(directory=templates_path)
```

**File:** main.py (L1-2)

```python
import nonebot
from nonebot.adapters.onebot.v11 import Adapter as OneBotV11Adapter
```

**File:** start.py (L1-4)

```python
#!/usr/bin/env python3
"""
NoneBot WebUI管理系统启动脚本
"""
```

**File:** start.py (L14-27)

```python
async def main():
    """主启动函数"""
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
```

**File:** start.py (L36-45)

```python
    try:
        import nonebot
        import fastapi
        import sqlalchemy

        print("✓ 依赖检查通过")
    except ImportError as e:
        print(f"✗ 依赖缺失: {e}")
        print("请运行: pip install -r requirements.txt")
        sys.exit(1)
```

