# nonebot2-with-webui

基于 NoneBot2 的 Web 管理系统，提供完整的可视化后台界面，支持通过浏览器管理机器人实例、插件、群组等功能。

## 项目简介

这是一个集成了 NoneBot2 机器人框架与 FastAPI web 框架的管理系统，通过直观的 Web 界面实现对机器人的全生命周期管理，包括插件加载、群组配置、日志查看等功能，降低机器人运维门槛。

## 核心特性

- **用户认证**：安全的登录机制与权限管理
- **机器人管理**：支持启动、停止、重启机器人实例
- **插件管理**：可视化插件列表，支持插件启用/禁用
- **群组管理**：查看群组信息，配置群管权限与消息过滤规则
- **日志系统**：实时查看机器人运行日志，支持按级别筛选
- **系统监控**：查看机器人内存占用、CPU 使用等运行状态

## 技术栈

| 模块       | 技术/框架                |
|------------|-------------------------|
| Web 框架   | FastAPI                 |
| 机器人框架 | NoneBot2 + OneBotV11 适配器 |
| 数据库     | SQLite（通过 SQLAlchemy 异步 ORM） |
| 模板引擎   | Jinja2                  |
| 前端       | Tailwind CSS、Font Awesome |
## 快速开始
### 安装依赖
```bash
pip install -r requirements.txt
```
### 启动服务
```bash
# 使用启动脚本
python start.py

# 或直接运行主程序
python main.py
```
## 访问系统
服务启动后，访问``` http://localhost:8080/web_ui ```进入管理界面，默认账号密码为``` admin/admin123```（首次登录后请及时修改密码）。
### 项目结构
```plaintext
nonebot2-with-webui/
├── core/              # 核心功能模块
│   ├── application.py # FastAPI 应用初始化
│   ├── database.py    # 数据库连接与 ORM 配置
│   ├── nonebot_manager.py # NoneBot 生命周期管理
│   └── security.py    # 认证与权限控制
├── modules/           # 业务逻辑模块
│   ├── auth/          # 认证相关
│   ├── group/         # 群组管理
│   ├── log/           # 日志系统
│   ├── plugin/        # 插件管理
│   └── system/        # 系统管理
├── web/               # Web 界面相关
│   ├── routes.py      # 路由注册
│   ├── templates/     # HTML 模板
│   └── static/        # 静态资源
├── config/            # 配置文件
│   ├── __init__.py    # 配置加载
│   ├── bot_config.py  # 机器人配置
│   └── web_config.py  # Web 界面配置
├── data/              # 数据存储
│   ├── db/            # 数据库文件
│   └── logs/          # 日志文件
├── plugins/           # NoneBot 插件
│   ├── __init__.py    # 插件注册
│   └── example_plugin.py # 示例插件
├── main.py            # 主程序入口
├── start.py           # 启动脚本
└── requirements.txt   # 依赖列表
```
## 配置说明
### 机器人配置
在``` config/bot_config.py ```中配置``` NoneBot ```相关参数：
```python
运行
# 机器人账号配置
SUPERUSERS = {123456789}  # 超级用户 ID
NICKNAME = {"Bot", "机器人"}  # 机器人昵称
COMMAND_START = {"!", "/"}  # 命令前缀
``` 
### Web 界面配置
在 config/web_config.py 中配置 Web 服务参数：

```python
运行
# Web 服务配置
HOST = "0.0.0.0"  # 监听地址
PORT = 8080       # 端口号
DEBUG = False     # 调试模式
SECRET_KEY = "your_secret_key"  # JWT 密钥（请务必修改）
```
### 依赖检查机制
启动脚本会自动验证核心依赖是否安装：

```python
运行
# start.py 依赖检查部分
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
若提示依赖缺失，执行``` pip install -r requirements.txt ```安装所需包。

## 相关截图 
[!登录界面](https://github.com/qingxuanya/nonebot2-with-webui/raw/main/config/1.jpeg)]

## 许可证
本项目遵循 MIT 许可证，欢迎贡献与二次开发。

## Deepwiki
访问：<https://deepwiki.com/qingxuanya/nonebot2-with-webui/1-overview>
