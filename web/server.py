from fastapi import FastAPI, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from core.security import login_required
import os


class WebUIServer:
    def __init__(self, app: FastAPI):
        self.app = app
        self.templates = app.state.templates

    def setup_routes(self):
        """设置Web路由"""

        @self.app.get("/", response_class=HTMLResponse)
        @login_required
        async def dashboard(request: Request):
            return self.templates.TemplateResponse("dashboard.html", {"request": request})

        @self.app.get("/login", response_class=HTMLResponse)
        async def login_page(request: Request):
            return self.templates.TemplateResponse("login.html", {"request": request})

        @self.app.get("/system", response_class=HTMLResponse)
        @login_required
        async def system_page(request: Request):
            return self.templates.TemplateResponse("system.html", {"request": request})

        @self.app.get("/groups", response_class=HTMLResponse)
        @login_required
        async def groups_page(request: Request):
            return self.templates.TemplateResponse("groups.html", {"request": request})

        @self.app.get("/plugins", response_class=HTMLResponse)
        @login_required
        async def plugins_page(request: Request):
            return self.templates.TemplateResponse("plugins.html", {"request": request})

        @self.app.get("/users", response_class=HTMLResponse)
        @login_required
        async def users_page(request: Request):
            return self.templates.TemplateResponse("users.html", {"request": request})

        @self.app.get("/logs", response_class=HTMLResponse)
        @login_required
        async def logs_page(request: Request):
            return self.templates.TemplateResponse("logs.html", {"request": request})

        @self.app.get("/api/health")
        async def health_check():
            return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}