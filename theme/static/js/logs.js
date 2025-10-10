class LogsManager {
    constructor() {
        this.currentTabs = {
            message: { page: 1, pageSize: 20 },
            system: { page: 1, pageSize: 20 },
            operation: { page: 1, pageSize: 20 }
        };
        this.searchParams = {
            message: {},
            system: {},
            operation: {}
        };
        this.init();
    }

    async init() {
        // 先检查认证状态
        const isAuthenticated = await this.checkAuth();
        if (!isAuthenticated) return;

        this.setupEventListeners();
        this.loadMessageLogs();
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
            console.error('Auth check failed:', error);
            window.location.href = '/login';
            return false;
        }
    }

    setupEventListeners() {
        // 标签页切换
        document.getElementById('logsTabs')?.addEventListener('shown.bs.tab', (e) => {
            const target = e.target.getAttribute('href');
            this.handleTabChange(target);
        });

        // 消息日志搜索
        document.getElementById('searchMessageLogsBtn')?.addEventListener('click', () => {
            this.searchParams.message = this.getMessageLogsSearchParams();
            this.loadMessageLogs(1);
        });

        // 系统日志搜索
        document.getElementById('searchSystemLogsBtn')?.addEventListener('click', () => {
            this.searchParams.system = this.getSystemLogsSearchParams();
            this.loadSystemLogs(1);
        });

        // 操作日志搜索
        document.getElementById('searchOperationLogsBtn')?.addEventListener('click', () => {
            this.searchParams.operation = this.getOperationLogsSearchParams();
            this.loadOperationLogs(1);
        });

        // 日期输入框回车搜索
        ['#messageGroupId', '#messageUserId', '#messageStartDate', '#messageEndDate'].forEach(selector => {
            document.querySelector(selector)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchParams.message = this.getMessageLogsSearchParams();
                    this.loadMessageLogs(1);
                }
            });
        });
    }

    handleTabChange(target) {
        switch (target) {
            case '#messageLogsTab':
                this.loadMessageLogs();
                break;
            case '#systemLogsTab':
                this.loadSystemLogs();
                break;
            case '#operationLogsTab':
                this.loadOperationLogs();
                break;
        }
    }

    getMessageLogsSearchParams() {
        const startDate = document.getElementById('messageStartDate').value;
        const endDate = document.getElementById('messageEndDate').value;

        return {
            group_id: document.getElementById('messageGroupId').value || undefined,
            user_id: document.getElementById('messageUserId').value || undefined,
            start_time: startDate ? new Date(startDate + 'T00:00:00').toISOString() : undefined,
            end_time: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined
        };
    }

    getSystemLogsSearchParams() {
        return {
            level: document.getElementById('systemLogLevel').value || undefined,
            module: document.getElementById('systemLogModule').value || undefined,
            days: parseInt(document.getElementById('systemLogDays').value) || 7
        };
    }

    getOperationLogsSearchParams() {
        return {
            operator: document.getElementById('operationUser').value || undefined,
            operation_type: document.getElementById('operationType').value || undefined,
            days: parseInt(document.getElementById('operationDays').value) || 30
        };
    }

    async loadMessageLogs(page = 1) {
        this.currentTabs.message.page = page;

        const params = new URLSearchParams({
            page: page,
            page_size: this.currentTabs.message.pageSize,
            ...this.searchParams.message
        });

        try {
            const response = await fetch(`/api/logs/messages?${params}`, {
                credentials: 'include'
            });
            const data = await response.json();

            this.renderMessageLogsTable(data.logs);
            this.renderPagination('messageLogsPagination', data.total, data.page, data.page_size);
        } catch (error) {
            console.error('Failed to load message logs:', error);
            this.showNotification('加载消息日志失败', 'error');
        }
    }

    async loadSystemLogs(page = 1) {
        this.currentTabs.system.page = page;

        const params = new URLSearchParams({
            page: page,
            page_size: this.currentTabs.system.pageSize,
            ...this.searchParams.system
        });

        try {
            const response = await fetch(`/api/logs/system?${params}`, {
                credentials: 'include'
            });
            const data = await response.json();

            this.renderSystemLogsTable(data.logs);
            this.renderPagination('systemLogsPagination', data.total, data.page, data.page_size);
        } catch (error) {
            console.error('Failed to load system logs:', error);
            this.showNotification('加载系统日志失败', 'error');
        }
    }

    async loadOperationLogs(page = 1) {
        this.currentTabs.operation.page = page;

        const params = new URLSearchParams({
            page: page,
            page_size: this.currentTabs.operation.pageSize,
            ...this.searchParams.operation
        });

        try {
            const response = await fetch(`/api/logs/operations?${params}`, {
                credentials: 'include'
            });
            const data = await response.json();

            this.renderOperationLogsTable(data.logs);
            this.renderPagination('operationLogsPagination', data.total, data.page, data.page_size);
        } catch (error) {
            console.error('Failed to load operation logs:', error);
            this.showNotification('加载操作日志失败', 'error');
        }
    }

    renderMessageLogsTable(logs) {
        const tbody = document.querySelector('#messageLogsTable tbody');
        tbody.innerHTML = '';

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.showLogDetail(log));

                row.innerHTML = `
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.group_id}</td>
                    <td>${log.user_name || log.user_id}</td>
                    <td class="text-truncate" style="max-width: 300px;" title="${log.message_content}">
                        ${log.message_content}
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">暂无消息日志</td></tr>';
        }
    }

    renderSystemLogsTable(logs) {
        const tbody = document.querySelector('#systemLogsTable tbody');
        tbody.innerHTML = '';

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.showLogDetail(log));

                const levelBadge = this.getLevelBadge(log.level);

                row.innerHTML = `
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${levelBadge}</td>
                    <td>${log.module}</td>
                    <td class="text-truncate" style="max-width: 300px;" title="${log.message}">
                        ${log.message}
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">暂无系统日志</td></tr>';
        }
    }

    renderOperationLogsTable(logs) {
        const tbody = document.querySelector('#operationLogsTable tbody');
        tbody.innerHTML = '';

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.showLogDetail(log));

                row.innerHTML = `
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.operator}</td>
                    <td><span class="badge bg-info">${log.operation_type}</span></td>
                    <td>${log.target_type}${log.target_id ? `: ${log.target_id}` : ''}</td>
                    <td class="text-truncate" style="max-width: 200px;" title="${log.description}">
                        ${log.description}
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">暂无操作日志</td></tr>';
        }
    }

    getLevelBadge(level) {
        const levelColors = {
            'DEBUG': 'bg-secondary',
            'INFO': 'bg-info',
            'WARNING': 'bg-warning',
            'ERROR': 'bg-danger',
            'CRITICAL': 'bg-dark'
        };

        const color = levelColors[level] || 'bg-secondary';
        return `<span class="badge ${color}">${level}</span>`;
    }

    renderPagination(paginationId, total, page, pageSize) {
        const pagination = document.getElementById(paginationId);
        const totalPages = Math.ceil(total / pageSize);

        pagination.innerHTML = '';

        // 上一页
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${page === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#">上一页</a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page > 1) this.loadCurrentTabLogs(page - 1);
        });
        pagination.appendChild(prevLi);

        // 页码
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === page ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadCurrentTabLogs(i);
            });
            pagination.appendChild(li);
        }

        // 下一页
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${page === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#">下一页</a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page < totalPages) this.loadCurrentTabLogs(page + 1);
        });
        pagination.appendChild(nextLi);
    }

    loadCurrentTabLogs(page) {
        const activeTab = document.querySelector('#logsTabs .nav-link.active').getAttribute('href');

        switch (activeTab) {
            case '#messageLogsTab':
                this.loadMessageLogs(page);
                break;
            case '#systemLogsTab':
                this.loadSystemLogs(page);
                break;
            case '#operationLogsTab':
                this.loadOperationLogs(page);
                break;
        }
    }

    showLogDetail(log) {
        const content = document.getElementById('logDetailContent');
        content.textContent = JSON.stringify(log, null, 2);
        new bootstrap.Modal(document.getElementById('logDetailModal')).show();
    }

    showNotification(message, type = 'info') {
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

// 全局实例
const logsManager = new LogsManager();