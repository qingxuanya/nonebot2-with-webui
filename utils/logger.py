import logging
import sys
from pathlib import Path


def setup_logger():
    """设置日志配置 - 优化版本"""
    log_path = Path("logs")
    log_path.mkdir(exist_ok=True)

    # 创建 logger
    logger = logging.getLogger("webui")
    logger.setLevel(logging.INFO)

    # 清除已有的处理器
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    # 文件处理器 - 只记录到文件
    file_handler = logging.FileHandler('logs/webui.log', encoding='utf-8')
    file_handler.setLevel(logging.INFO)

    # 控制台处理器 - 只记录 ERROR 级别以上的日志
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.ERROR)  # 只显示错误信息

    # 日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # 添加处理器
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    # 设置第三方库的日志级别
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('fastapi').setLevel(logging.WARNING)
    logging.getLogger('nonebot').setLevel(logging.WARNING)

    return logger


# 全局日志实例
logger = setup_logger()