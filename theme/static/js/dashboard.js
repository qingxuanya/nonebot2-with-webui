class DashboardManager {
    constructor() {
        this.init();
    }

    async init() {
        // 先检查认证状态
        const isAuthenticated = await this.checkAuth();
        if (!isAuthenticated) return;

        this.loadDashboardData();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            if (!response.ok) {
                window.location.href = '/login';
                return false;
            }
            return true;
        } catch (error) {
            window.location.href = '/login';
            return false;
        }
    }

    setupEventListeners() {
        // 机器人操作按钮
        document.getElementById('startBotBtn')?.addEventListener('click', () => this.startBot());
        document.getElementById('stopBotBtn')?.addEventListener('click', () => this.stopBot());
        document.getElementById('restartBotBtn')?.addEventListener('click', () => this.restartBot());
    }

    async loadDashboardData() {
        try {
            const [systemStatus, userStats, pluginStats, logStats, recentMessages] = await Promise.all([
                this.apiCall('/system/status'),
                this.apiCall('/users/stats'),
                this.apiCall('/plugins/stats'),
                this.apiCall('/logs/stats'),
                this.apiCall('/logs/messages?page_size=10')
            ]);

            this.updateDashboard(systemStatus, userStats, pluginStats, logStats, recentMessages);
        } catch (error) {
            // 静默处理错误
        }
    }

    updateDashboard(systemStatus, userStats, pluginStats, logStats, recentMessages) {
        // 更新系统状态
        this.updateSystemStatus(systemStatus);

        // 更新统计卡片
        this.updateStatsCards(userStats, pluginStats, logStats);

        // 更新最近活动
        this.updateRecentActivity(recentMessages);
    }

    updateSystemStatus(status) {
        const botStatus = document.getElementById('botStatus');
        const uptime = document.getElementById('uptime');
        const lastRestart = document.getElementById('lastRestart');

        // 只更新状态文本，完全不修改颜色
        if (status.nonebot.is_running) {
            botStatus.textContent = '运行中';
        } else {
            botStatus.textContent = '已停止';
        }

        uptime.textContent = status.bot.start_time ?
            this.formatTimeDifference(new Date(status.bot.start_time)) : '--';

        lastRestart.textContent = status.bot.last_restart ?
            new Date(status.bot.last_restart).toLocaleString() : '--';
    }

    updateStatsCards(userStats, pluginStats, logStats) {
        document.getElementById('totalUsers').textContent = userStats.total_users || 0;
        document.getElementById('totalGroups').textContent = userStats.total_users || 0; // 临时使用用户数
        document.getElementById('todayMessages').textContent = logStats.today_messages || 0;
        document.getElementById('pluginCount').textContent = pluginStats.total_plugins || 0;
        document.getElementById('enabledPlugins').textContent = pluginStats.enabled_plugins || 0;
    }

    updateRecentActivity(messages) {
        const tbody = document.querySelector('#recentActivityTable tbody');
        tbody.innerHTML = '';

        if (messages.logs && messages.logs.length > 0) {
            messages.logs.forEach(message => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(message.timestamp).toLocaleString()}</td>
                    <td>${message.user_name || message.user_id}</td>
                    <td>${message.group_id}</td>
                    <td class="text-truncate" style="max-width: 200px;">${message.message_content}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">暂无数据</td></tr>';
        }
    }

    async startBot() {
        try {
            const result = await this.apiCall('/system/start', { method: 'POST' });
            this.showNotification(result.message, 'success');
            setTimeout(() => this.loadDashboardData(), 2000);
        } catch (error) {
            this.showNotification('启动失败', 'error');
        }
    }

    async stopBot() {
        try {
            const result = await this.apiCall('/system/stop', { method: 'POST' });
            this.showNotification(result.message, 'success');
            setTimeout(() => this.loadDashboardData(), 2000);
        } catch (error) {
            this.showNotification('停止失败', 'error');
        }
    }

    async restartBot() {
        try {
            const result = await this.apiCall('/system/restart', { method: 'POST' });
            this.showNotification(result.message, 'success');
            setTimeout(() => this.loadDashboardData(), 2000);
        } catch (error) {
            this.showNotification('重启失败', 'error');
        }
    }

    startAutoRefresh() {
        // 每30秒自动刷新数据
        setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }

    // 工具方法
    async apiCall(endpoint, options = {}) {
        const response = await fetch(`/api${endpoint}`, {
            credentials: 'include',
            ...options
        });
        return await response.json();
    }

    showNotification(message, type = 'info') {
        if (window.webUIManager) {
            window.webUIManager.showNotification(message, type);
        } else {
            // 简单的通知实现
            const alertClass = type === 'success' ? 'alert-success' :
                              type === 'error' ? 'alert-danger' : 'alert-info';

            const alert = document.createElement('div');
            alert.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
            alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
            alert.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;

            document.body.appendChild(alert);

            setTimeout(() => {
                alert.remove();
            }, 5000);
        }
    }

    formatTimeDifference(startTime) {
        const diff = Date.now() - new Date(startTime).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}天${hours}小时`;
        if (hours > 0) return `${hours}小时${minutes}分钟`;
        return `${minutes}分钟`;
    }
}

// 初始化仪表板
document.addEventListener('DOMContentLoaded', () => {
    new DashboardManager();
});