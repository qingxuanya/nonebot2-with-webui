from typing import Any, Dict
from datetime import datetime
import json

class JSONEncoder(json.JSONEncoder):
    """自定义JSON编码器"""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def format_response(success: bool, message: str, data: Any = None) -> Dict[str, Any]:
    """格式化API响应"""
    response = {
        "success": success,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    if data is not None:
        response["data"] = data
    return response

def paginate_data(data: list, page: int, page_size: int, total: int) -> Dict[str, Any]:
    """分页数据格式化"""
    return {
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size
        }
    }