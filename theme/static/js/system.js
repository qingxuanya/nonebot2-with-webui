class SystemManager {
    constructor() {
        this.init();
        this.autoRefreshInterval = null;
    }

    async init() {
        // 先检查认证状态
        const isAuthenticated = await this.checkAuth();
        if (!isAuthenticated) return;

        this.loadSystemStatus();
        this.loadSystemConfig();
        this.setupEventListeners();

        // 启动自动刷新
        this.startAutoRefresh();
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            if (!response.ok) {
                window.location.href = '/web_ui/login';
                return false;
            }
            return true;
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/web_ui/login';
            return false;
        }
    }

    setupEventListeners() {
        // 机器人操作按钮
        document.getElementById('startBotBtn')?.addEventListener('click', () => this.startBot());
        document.getElementById('stopBotBtn')?.addEventListener('click', () => this.stopBot());
        document.getElementById('restartBotBtn')?.addEventListener('click', () => this.restartBot());

        // 配置表单提交
        document.getElementById('onebotConfigForm')?.addEventListener('submit', (e) => this.saveOneBotConfig(e));
        document.getElementById('botConfigForm')?.addEventListener('submit', (e) => this.saveBotConfig(e));
    }

    async loadSystemStatus() {
        try {
            console.log("正在加载系统状态...");
            const status = await this.apiCall('/system/status');
            console.log("系统状态加载成功:", status);
            this.renderSystemStatus(status);
            this.renderSystemInfo(status);
        } catch (error) {
            console.error('Failed to load system status:', error);
            this.showNotification('加载系统状态失败', 'error');
        }
    }

    async loadSystemConfig() {
        try {
            const config = await this.apiCall('/system/config');
            this.populateConfigForms(config);
        } catch (error) {
            console.error('Failed to load system config:', error);
            this.showNotification('加载系统配置失败', 'error');
        }
    }

    renderSystemStatus(status) {
        const container = document.getElementById('systemStatus');
        if (!container) return;

        const isRunning = status.nonebot.is_running;
        const botRunning = status.bot.is_running;
        const startTime = status.bot.start_time;
        const lastRestart = status.bot.last_restart;

        console.log("渲染系统状态:", {
            isRunning,
            botRunning,
            startTime,
            lastRestart
        });

        if (isRunning) {
            container.innerHTML = `
                <div class="alert alert-success">
                    <h6><i class="bi bi-check-circle"></i> 机器人运行中</h6>
                    <p class="mb-1"><strong>启动时间:</strong> ${startTime ? this.formatDateTime(startTime) : '未知'}</p>
                    <p class="mb-1"><strong>最后重启:</strong> ${lastRestart ? this.formatDateTime(lastRestart) : '从未重启'}</p>
                    <p class="mb-0"><strong>适配器:</strong> ${status.nonebot.adapters.join(', ')}</p>
                    <p class="mb-0">
                        <small class="text-muted">
                            状态同步: ${botRunning === isRunning ? 
                                '<span class="text-success">正常</span>' : 
                                '<span class="text-warning">异常</span>'
                            }
                        </small>
                    </p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <h6><i class="bi bi-x-circle"></i> 机器人已停止</h6>
                    <p class="mb-0">机器人当前未运行，请点击启动按钮开始运行。</p>
                    <p class="mb-0">
                        <small class="text-muted">
                            状态同步: ${botRunning === isRunning ? 
                                '<span class="text-success">正常</span>' : 
                                '<span class="text-warning">异常</span>'
                            }
                        </small>
                    </p>
                </div>
            `;
        }
    }

    renderSystemInfo(status) {
        const container = document.getElementById('systemInfo');
        if (!container) return;

        container.innerHTML = `
            <div class="col-md-4">
                <h6>平台信息</h6>
                <p><strong>系统:</strong> ${status.system.platform}</p>
                <p><strong>Python版本:</strong> ${status.system.python_version}</p>
                <p><strong>NoneBot版本:</strong> ${status.system.nonebot_version}</p>
            </div>
            <div class="col-md-4">
                <h6>统计信息</h6>
                <p><strong>总消息数:</strong> ${status.bot.total_messages || 0}</p>
                <p><strong>活跃群组:</strong> ${status.bot.active_groups || 0}</p>
                <p><strong>活跃用户:</strong> ${status.bot.active_users || 0}</p>
            </div>
            <div class="col-md-4">
                <h6>数据库</h6>
                <p><strong>主数据库:</strong> data.db</p>
                <p><strong>日志数据库:</strong> log.db</p>
                <p><strong>会话管理:</strong> 正常</p>
            </div>
        `;
    }

    populateConfigForms(config) {
        // OneBot配置
        const onebot = config.onebot || {};
        document.getElementById('wsUrl').value = onebot.ws_url || 'ws://127.0.0.1:8080/onebot/v11/ws';
        document.getElementById('httpUrl').value = onebot.http_url || 'http://127.0.0.1:5700';
        document.getElementById('accessToken').value = onebot.access_token || '';
        document.getElementById('secret').value = onebot.secret || '';

        // 机器人配置
        const bot = config.bot || {};
        document.getElementById('nickname').value = Array.isArray(bot.nickname) ? bot.nickname.join(',') : (bot.nickname || 'Bot');
        document.getElementById('commandStart').value = Array.isArray(bot.command_start) ? bot.command_start.join(',') : (bot.command_start || '/');
        document.getElementById('superusers').value = Array.isArray(bot.superusers) ? bot.superusers.join(',') : (bot.superusers || '');
        document.getElementById('sessionTimeout').value = bot.session_expire_timeout || 120;
    }

    async saveOneBotConfig(e) {
        e.preventDefault();

        const config = {
            onebot: {
                ws_url: document.getElementById('wsUrl').value,
                http_url: document.getElementById('httpUrl').value,
                access_token: document.getElementById('accessToken').value,
                secret: document.getElementById('secret').value
            }
        };

        try {
            const result = await this.apiCall('/system/config', {
                method: 'PUT',
                body: JSON.stringify(config)
            });

            this.showNotification('OneBot配置保存成功', 'success');
        } catch (error) {
            this.showNotification('保存失败', 'error');
        }
    }

    async saveBotConfig(e) {
        e.preventDefault();

        const config = {
            bot: {
                nickname: document.getElementById('nickname').value.split(',').map(s => s.trim()),
                command_start: document.getElementById('commandStart').value.split(',').map(s => s.trim()),
                superusers: document.getElementById('superusers').value.split(',').map(s => s.trim()).filter(s => s),
                session_expire_timeout: parseInt(document.getElementById('sessionTimeout').value)
            }
        };

        try {
            const result = await this.apiCall('/system/config', {
                method: 'PUT',
                body: JSON.stringify(config)
            });

            this.showNotification('机器人配置保存成功', 'success');
        } catch (error) {
            this.showNotification('保存失败', 'error');
        }
    }

    async startBot() {
        console.log("尝试启动机器人...");
        try {
            const result = await this.apiCall('/system/start', { method: 'POST' });
            this.showNotification(result.message, 'success');

            // 启动后立即刷新状态，然后定期刷新
            setTimeout(() => {
                this.loadSystemStatus();
                console.log("状态已刷新");
            }, 1000);

            // 持续刷新直到状态稳定
            this.refreshUntilStable(true);

        } catch (error) {
            console.error("启动失败:", error);
            this.showNotification('启动失败', 'error');
        }
    }

    async stopBot() {
        console.log("尝试停止机器人...");
        try {
            const result = await this.apiCall('/system/stop', { method: 'POST' });
            this.showNotification(result.message, 'success');

            // 停止后立即刷新状态，然后定期刷新
            setTimeout(() => {
                this.loadSystemStatus();
                console.log("状态已刷新");
            }, 1000);

            // 持续刷新直到状态稳定
            this.refreshUntilStable(false);

        } catch (error) {
            console.error("停止失败:", error);
            this.showNotification('停止失败', 'error');
        }
    }

    async restartBot() {
        console.log("尝试重启机器人...");
        try {
            const result = await this.apiCall('/system/restart', { method: 'POST' });
            this.showNotification(result.message, 'success');

            // 重启后立即刷新状态，然后定期刷新
            setTimeout(() => {
                this.loadSystemStatus();
                console.log("状态已刷新");
            }, 1000);

            // 持续刷新直到状态稳定
            this.refreshUntilStable(true);

        } catch (error) {
            console.error("重启失败:", error);
            this.showNotification('重启失败', 'error');
        }
    }

    refreshUntilStable(expectedRunning) {
        let attempts = 0;
        const maxAttempts = 10;

        const checkStatus = async () => {
            if (attempts >= maxAttempts) {
                console.log("达到最大重试次数，停止检查");
                return;
            }

            attempts++;
            console.log(`检查状态 (${attempts}/${maxAttempts})...`);

            try {
                const status = await this.apiCall('/system/status');
                const isRunning = status.nonebot.is_running;

                if (isRunning === expectedRunning) {
                    console.log(`状态已稳定: ${isRunning}`);
                    this.loadSystemStatus(); // 最终刷新一次
                    return;
                }

                // 状态还未稳定，继续检查
                setTimeout(checkStatus, 1000);
            } catch (error) {
                console.error("检查状态失败:", error);
                setTimeout(checkStatus, 1000);
            }
        };

        setTimeout(checkStatus, 2000);
    }

    startAutoRefresh() {
        // 每10秒自动刷新状态
        this.autoRefreshInterval = setInterval(() => {
            this.loadSystemStatus();
        }, 10000);

        console.log("自动刷新已启动");
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log("自动刷新已停止");
        }
    }

    // 工具方法
    formatDateTime(dateString) {
        if (!dateString) return '未知';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            console.error("日期格式化错误:", error);
            return '格式错误';
        }
    }

    async apiCall(endpoint, options = {}) {
        const response = await fetch(`/api${endpoint}`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API调用失败: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    showNotification(message, type = 'info') {
        const alertClass = type === 'success' ? 'alert-success' :
                          type === 'warning' ? 'alert-warning' :
                          type === 'error' ? 'alert-danger' : 'alert-info';

        // 移除现有通知
        const existingAlerts = document.querySelectorAll('.global-notification');
        existingAlerts.forEach(alert => alert.remove());

        const alert = document.createElement('div');
        alert.className = `alert ${alertClass} alert-dismissible fade show global-notification position-fixed`;
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alert.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi ${this.getNotificationIcon(type)} me-2"></i>
                <span>${message}</span>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>
        `;

        document.body.appendChild(alert);

        // 自动移除
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'bi-check-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            error: 'bi-x-circle-fill',
            info: 'bi-info-circle-fill'
        };
        return icons[type] || 'bi-info-circle-fill';
    }

    // 清理资源
    destroy() {
        this.stopAutoRefresh();
    }
}

// 初始化系统管理
document.addEventListener('DOMContentLoaded', () => {
    window.systemManager = new SystemManager();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.systemManager) {
        window.systemManager.destroy();
    }
});