from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from datetime import datetime
from .service import LogService
from core.security import verify_token

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/messages")
async def get_message_logs(
        request: Request,
        group_id: Optional[str] = Query(None),
        user_id: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        start_time: Optional[datetime] = Query(None),
        end_time: Optional[datetime] = Query(None)
):
    """获取消息日志"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await LogService.get_message_logs(group_id, user_id, page, page_size, start_time, end_time)


@router.get("/system")
async def get_system_logs(
        request: Request,
        level: Optional[str] = Query(None),
        module: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        days: int = Query(7, ge=1, le=365)
):
    """获取系统日志"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await LogService.get_system_logs(level, module, page, page_size, days)


@router.get("/operations")
async def get_operation_logs(
        request: Request,
        operator: Optional[str] = Query(None),
        operation_type: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        days: int = Query(30, ge=1, le=365)
):
    """获取操作日志"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await LogService.get_operation_logs(operator, operation_type, page, page_size, days)


@router.get("/stats")
async def get_log_stats(request: Request):
    """获取日志统计"""
    token = request.cookies.get("access_token")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权")

    return await LogService.get_log_stats()