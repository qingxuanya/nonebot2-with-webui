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
        const logsTabs = document.getElementById('logsTabs');
        if (logsTabs) {
            logsTabs.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('href');
                this.handleTabChange(target);
            });
        }

        // 消息日志搜索
        const messageSearchBtn = document.getElementById('searchMessageLogsBtn');
        if (messageSearchBtn) {
            messageSearchBtn.addEventListener('click', () => {
                this.searchParams.message = this.getMessageLogsSearchParams();
                this.loadMessageLogs(1);
            });
        }

        // 系统日志搜索
        const systemSearchBtn = document.getElementById('searchSystemLogsBtn');
        if (systemSearchBtn) {
            systemSearchBtn.addEventListener('click', () => {
                this.searchParams.system = this.getSystemLogsSearchParams();
                this.loadSystemLogs(1);
            });
        }

        // 操作日志搜索
        const operationSearchBtn = document.getElementById('searchOperationLogsBtn');
        if (operationSearchBtn) {
            operationSearchBtn.addEventListener('click', () => {
                this.searchParams.operation = this.getOperationLogsSearchParams();
                this.loadOperationLogs(1);
            });
        }

        // 日期输入框回车搜索
        ['#messageGroupId', '#messageUserId', '#messageStartDate', '#messageEndDate'].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.searchParams.message = this.getMessageLogsSearchParams();
                        this.loadMessageLogs(1);
                    }
                });
            }
        });

        // 系统日志输入框回车搜索
        ['#systemLogLevel', '#systemLogModule', '#systemLogDays'].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.searchParams.system = this.getSystemLogsSearchParams();
                        this.loadSystemLogs(1);
                    }
                });
            }
        });

        // 操作日志输入框回车搜索
        ['#operationUser', '#operationType', '#operationDays'].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.searchParams.operation = this.getOperationLogsSearchParams();
                        this.loadOperationLogs(1);
                    }
                });
            }
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
        const groupIdInput = document.getElementById('messageGroupId');
        const userIdInput = document.getElementById('messageUserId');
        const startDateInput = document.getElementById('messageStartDate');
        const endDateInput = document.getElementById('messageEndDate');

        const startDate = startDateInput ? startDateInput.value : '';
        const endDate = endDateInput ? endDateInput.value : '';

        const params = {};

        if (groupIdInput && groupIdInput.value.trim()) {
            params.group_id = groupIdInput.value.trim();
        }

        if (userIdInput && userIdInput.value.trim()) {
            params.user_id = userIdInput.value.trim();
        }

        if (startDate) {
            params.start_time = new Date(startDate + 'T00:00:00').toISOString();
        }

        if (endDate) {
            params.end_time = new Date(endDate + 'T23:59:59').toISOString();
        }

        console.log('消息日志搜索参数:', params);
        return params;
    }

    getSystemLogsSearchParams() {
        const levelInput = document.getElementById('systemLogLevel');
        const moduleInput = document.getElementById('systemLogModule');
        const daysInput = document.getElementById('systemLogDays');

        const params = {};

        if (levelInput && levelInput.value) {
            params.level = levelInput.value;
        }

        if (moduleInput && moduleInput.value.trim()) {
            params.module = moduleInput.value.trim();
        }

        if (daysInput) {
            params.days = parseInt(daysInput.value) || 7;
        }

        console.log('系统日志搜索参数:', params);
        return params;
    }

    getOperationLogsSearchParams() {
        const userInput = document.getElementById('operationUser');
        const typeInput = document.getElementById('operationType');
        const daysInput = document.getElementById('operationDays');

        const params = {};

        if (userInput && userInput.value.trim()) {
            params.operator = userInput.value.trim();
        }

        if (typeInput && typeInput.value.trim()) {
            params.operation_type = typeInput.value.trim();
        }

        if (daysInput) {
            params.days = parseInt(daysInput.value) || 30;
        }

        console.log('操作日志搜索参数:', params);
        return params;
    }

    async loadMessageLogs(page = 1) {
        this.currentTabs.message.page = page;

        // 构建查询参数
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', this.currentTabs.message.pageSize);

        // 添加搜索参数
        Object.entries(this.searchParams.message).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                params.append(key, value);
            }
        });

        console.log('加载消息日志，参数:', Object.fromEntries(params));

        try {
            const response = await fetch(`/api/logs/messages?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('消息日志数据:', data);

            this.renderMessageLogsTable(data.logs || []);
            this.renderPagination('messageLogsPagination', data.total || 0, data.page || 1, data.page_size || this.currentTabs.message.pageSize);
        } catch (error) {
            console.error('Failed to load message logs:', error);
            this.showNotification('加载消息日志失败: ' + error.message, 'error');
        }
    }

    async loadSystemLogs(page = 1) {
        this.currentTabs.system.page = page;

        // 构建查询参数
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', this.currentTabs.system.pageSize);

        // 添加搜索参数
        Object.entries(this.searchParams.system).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                params.append(key, value);
            }
        });

        console.log('加载系统日志，参数:', Object.fromEntries(params));

        try {
            const response = await fetch(`/api/logs/system?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('系统日志数据:', data);

            this.renderSystemLogsTable(data.logs || []);
            this.renderPagination('systemLogsPagination', data.total || 0, data.page || 1, data.page_size || this.currentTabs.system.pageSize);
        } catch (error) {
            console.error('Failed to load system logs:', error);
            this.showNotification('加载系统日志失败: ' + error.message, 'error');
        }
    }

    async loadOperationLogs(page = 1) {
        this.currentTabs.operation.page = page;

        // 构建查询参数
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', this.currentTabs.operation.pageSize);

        // 添加搜索参数
        Object.entries(this.searchParams.operation).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                params.append(key, value);
            }
        });

        console.log('加载操作日志，参数:', Object.fromEntries(params));

        try {
            const response = await fetch(`/api/logs/operations?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('操作日志数据:', data);

            this.renderOperationLogsTable(data.logs || []);
            this.renderPagination('operationLogsPagination', data.total || 0, data.page || 1, data.page_size || this.currentTabs.operation.pageSize);
        } catch (error) {
            console.error('Failed to load operation logs:', error);
            this.showNotification('加载操作日志失败: ' + error.message, 'error');
        }
    }

    renderMessageLogsTable(logs) {
        const tbody = document.querySelector('#messageLogsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.showLogDetail(log));

                // 安全处理日志数据
                const groupId = log.group_id || '--';
                const userName = log.user_name || log.user_id || '未知用户';
                const messageContent = log.message_content || '';
                const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : '--';

                row.innerHTML = `
                    <td>${timestamp}</td>
                    <td>${this.escapeHtml(groupId)}</td>
                    <td>${this.escapeHtml(userName)}</td>
                    <td class="text-truncate" style="max-width: 300px;" title="${this.escapeHtml(messageContent)}">
                        ${this.escapeHtml(messageContent)}
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">暂无消息日志</td></tr>';
        }
    }

    renderSystemLogsTable(logs) {
        const tbody = document.querySelector('#systemLogsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.showLogDetail(log));

                const levelBadge = this.getLevelBadge(log.level);
                const moduleName = log.module || 'system';
                const message = log.message || '';
                const timestamp = log.created_at ? new Date(log.created_at).toLocaleString() : '--';

                row.innerHTML = `
                    <td>${timestamp}</td>
                    <td>${levelBadge}</td>
                    <td>${this.escapeHtml(moduleName)}</td>
                    <td class="text-truncate" style="max-width: 300px;" title="${this.escapeHtml(message)}">
                        ${this.escapeHtml(message)}
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">暂无系统日志</td></tr>';
        }
    }

    renderOperationLogsTable(logs) {
        const tbody = document.querySelector('#operationLogsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.showLogDetail(log));

                const operator = log.operator || 'system';
                const operationType = log.operation_type || 'unknown';
                const targetType = log.target_type || '';
                const targetId = log.target_id || '';
                const description = log.description || '';
                const timestamp = log.created_at ? new Date(log.created_at).toLocaleString() : '--';

                row.innerHTML = `
                    <td>${timestamp}</td>
                    <td>${this.escapeHtml(operator)}</td>
                    <td><span class="badge bg-info">${this.escapeHtml(operationType)}</span></td>
                    <td>${this.escapeHtml(targetType)}${targetId ? `: ${this.escapeHtml(targetId)}` : ''}</td>
                    <td class="text-truncate" style="max-width: 200px;" title="${this.escapeHtml(description)}">
                        ${this.escapeHtml(description)}
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">暂无操作日志</td></tr>';
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
        if (!pagination) return;

        const totalPages = Math.ceil(total / pageSize) || 1;

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
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let i = startPage; i <= endPage; i++) {
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
        const activeTab = document.querySelector('#logsTabs .nav-link.active');
        if (!activeTab) return;

        const target = activeTab.getAttribute('href');

        switch (target) {
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
        if (!content) return;

        content.textContent = JSON.stringify(log, null, 2);
        new bootstrap.Modal(document.getElementById('logDetailModal')).show();
    }

    // 工具方法
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
}

// 全局实例
const logsManager = new LogsManager();