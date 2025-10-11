class DashboardManager {
    constructor() {
        this.autoRefreshInterval = null;
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
            console.log('🔄 自动刷新仪表板数据...');

            // 并行加载所有数据
            const [systemStatus, userStats, pluginStats, logStats, recentMessages] = await Promise.all([
                this.apiCall('/api/system/status').catch(e => ({ bot: { is_running: false } })),
                this.apiCall('/api/users/stats').catch(e => ({ total_users: 0, active_users: 0 })),
                this.apiCall('/api/plugins/stats').catch(e => ({ total_plugins: 0, enabled_plugins: 0 })),
                this.apiCall('/api/logs/stats').catch(e => ({ today_messages: 0, message_total: 0 })),
                this.apiCall('/api/logs/messages?page_size=10').catch(e => ({ logs: [] }))
            ]);

            this.updateDashboard(systemStatus, userStats, pluginStats, logStats, recentMessages);
        } catch (error) {
            console.error('❌ 加载仪表板数据失败:', error);
        }
    }

    updateDashboard(systemStatus, userStats, pluginStats, logStats, recentMessages) {
        // 更新系统状态
        this.updateSystemStatus(systemStatus);

        // 更新统计卡片
        this.updateStatsCards(userStats, pluginStats, logStats);

        // 更新系统信息
        this.updateSystemInfo(pluginStats, systemStatus);

        // 更新最近活动
        this.updateRecentActivity(recentMessages);
    }

    updateSystemStatus(status) {
        const botStatus = document.getElementById('botStatus');
        const botStatusCard = document.getElementById('botStatusCard');
        const uptime = document.getElementById('uptime');
        const lastRestart = document.getElementById('lastRestart');

        if (status && status.bot) {
            // 更新状态文本和颜色
            if (status.bot.is_running) {
                botStatus.textContent = '运行中';
                if (botStatusCard) {
                    botStatusCard.className = 'card bg-success text-white';
                }
            } else {
                botStatus.textContent = '已停止';
                if (botStatusCard) {
                    botStatusCard.className = 'card bg-danger text-white';
                }
            }

            if (uptime) {
                uptime.textContent = status.bot.start_time ?
                    this.formatTimeDifference(new Date(status.bot.start_time)) : '--';
            }

            if (lastRestart) {
                lastRestart.textContent = status.bot.last_restart ?
                    new Date(status.bot.last_restart).toLocaleString() : '--';
            }
        }
    }

    updateStatsCards(userStats, pluginStats, logStats) {
        // 安全地更新所有统计卡片
        this.updateCard('totalUsers', userStats?.total_users || 0);
        this.updateCard('totalGroups', userStats?.total_users || 0); // 临时使用用户数
        this.updateCard('todayMessages', logStats?.today_messages || 0);

        // 如果logStats中有总消息数也更新
        if (logStats?.message_total !== undefined) {
            const totalMessagesElement = document.getElementById('totalMessages');
            if (totalMessagesElement) {
                totalMessagesElement.textContent = this.formatNumber(logStats.message_total);
            }
        }
    }

    updateCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = this.formatNumber(value);
        }
    }

    updateSystemInfo(pluginStats, systemStatus) {
        const pluginCount = document.getElementById('pluginCount');
        const enabledPlugins = document.getElementById('enabledPlugins');
        const lastRestart = document.getElementById('lastRestart');
        const uptime = document.getElementById('uptime');

        if (pluginCount) pluginCount.textContent = pluginStats?.total_plugins || 0;
        if (enabledPlugins) enabledPlugins.textContent = pluginStats?.enabled_plugins || 0;

        if (lastRestart && systemStatus?.bot?.last_restart) {
            lastRestart.textContent = new Date(systemStatus.bot.last_restart).toLocaleString();
        } else if (lastRestart) {
            lastRestart.textContent = '--';
        }

        if (uptime && systemStatus?.bot?.start_time) {
            uptime.textContent = this.formatTimeDifference(new Date(systemStatus.bot.start_time));
        } else if (uptime) {
            uptime.textContent = '--';
        }
    }

    updateRecentActivity(messages) {
        const tbody = document.querySelector('#recentActivityTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (messages && messages.logs && messages.logs.length > 0) {
            messages.logs.forEach(message => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(message.timestamp).toLocaleString()}</td>
                    <td>${message.user_name || message.user_id || '未知用户'}</td>
                    <td>${message.group_id || '私聊'}</td>
                    <td class="text-truncate" style="max-width: 200px;" title="${message.message_content || ''}">
                        ${this.escapeHtml(message.message_content || '')}
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">暂无活动数据</td></tr>';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async startBot() {
        try {
            const result = await this.apiCall('/api/system/start', { method: 'POST' });
            this.showNotification(result.message || '启动成功', 'success');
            // 2秒后自动刷新状态
            setTimeout(() => this.loadDashboardData(), 2000);
        } catch (error) {
            this.showNotification('启动失败', 'error');
        }
    }

    async stopBot() {
        try {
            const result = await this.apiCall('/api/system/stop', { method: 'POST' });
            this.showNotification(result.message || '停止成功', 'success');
            // 2秒后自动刷新状态
            setTimeout(() => this.loadDashboardData(), 2000);
        } catch (error) {
            this.showNotification('停止失败', 'error');
        }
    }

    async restartBot() {
        try {
            const result = await this.apiCall('/api/system/restart', { method: 'POST' });
            this.showNotification(result.message || '重启成功', 'success');
            // 2秒后自动刷新状态
            setTimeout(() => this.loadDashboardData(), 2000);
        } catch (error) {
            this.showNotification('重启失败', 'error');
        }
    }

    startAutoRefresh() {
        // 每30秒自动刷新数据
        this.autoRefreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 30000);

        console.log('✅ 自动刷新已启动 (30秒间隔)');
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    // 工具方法
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API调用失败 ${endpoint}:`, error);
            throw error;
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
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

    showNotification(message, type = 'info') {
        // 使用 Bootstrap 的 toast 通知
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();

        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.id = toastId;

        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toast);

        const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
        bsToast.show();

        // 自动移除DOM元素
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }

    // 清理资源
    destroy() {
        this.stopAutoRefresh();
    }
}

// 初始化仪表板
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.dashboardManager) {
        window.dashboardManager.destroy();
    }
});