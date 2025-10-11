class UsersManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.searchParams = {};
        this.currentUserId = null; // 当前查看的用户ID
        this.privateHistoryPage = 1;
        this.groupHistoryPage = 1;
        this.privateHistoryPageSize = 20;
        this.groupHistoryPageSize = 20;
        this.init();
    }

    async init() {
        // 先检查认证状态
        const isAuthenticated = await this.checkAuth();
        if (!isAuthenticated) return;

        this.loadUsers();
        this.setupEventListeners();
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
        // 搜索功能 - 修复事件监听
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        const bannedFilter = document.getElementById('bannedFilter');
        const sortBy = document.getElementById('sortBy');
        const sortOrder = document.getElementById('sortOrder');
        const statsBtn = document.querySelector('[data-bs-target="#userStatsModal"]');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }

        if (bannedFilter) {
            bannedFilter.addEventListener('change', () => this.handleSearch());
        }

        if (sortBy) {
            sortBy.addEventListener('change', () => this.handleSearch());
        }

        if (sortOrder) {
            sortOrder.addEventListener('change', () => this.handleSearch());
        }

        if (statsBtn) {
            statsBtn.addEventListener('click', () => this.loadUserStats());
        }

        // 确认封禁按钮事件
        const confirmBanBtn = document.getElementById('confirmBanBtn');
        if (confirmBanBtn) {
            confirmBanBtn.addEventListener('click', () => this.confirmBan());
        }

        // 历史消息标签页切换事件
        const userDetailTabs = document.getElementById('userDetailTabs');
        if (userDetailTabs) {
            userDetailTabs.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('href');
                this.handleUserDetailTabChange(target);
            });
        }

        // 历史消息搜索回车事件
        ['#privateStartDate', '#privateEndDate', '#groupStartDate', '#groupEndDate', '#groupHistoryFilter'].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const activeTab = document.querySelector('#userDetailTabs .nav-link.active').getAttribute('href');
                        if (activeTab === '#userPrivateHistoryTab') {
                            this.loadPrivateHistory(1);
                        } else if (activeTab === '#userGroupHistoryTab') {
                            this.loadGroupHistory(1);
                        }
                    }
                });
            }
        });
    }

    handleUserDetailTabChange(target) {
        switch (target) {
            case '#userPrivateHistoryTab':
                this.loadPrivateHistory();
                break;
            case '#userGroupHistoryTab':
                this.loadGroupHistory();
                break;
        }
    }

    async loadUsers(page = 1) {
        this.currentPage = page;

        // 构建查询参数 - 修复参数传递
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', this.pageSize);

        // 添加搜索参数
        if (this.searchParams.search) {
            params.append('search', this.searchParams.search);
        }
        if (this.searchParams.banned !== undefined && this.searchParams.banned !== '') {
            params.append('banned', this.searchParams.banned);
        }
        if (this.searchParams.sort_by) {
            params.append('sort_by', this.searchParams.sort_by);
        }
        if (this.searchParams.sort_order) {
            params.append('sort_order', this.searchParams.sort_order);
        }

        console.log('加载用户，参数:', Object.fromEntries(params));

        try {
            const response = await fetch(`/api/users?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('用户数据:', data);

            this.renderUsersTable(data.users || [], data.user_stats || {});
            this.renderPagination(data.total || 0, data.page || 1, data.page_size || this.pageSize);
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showNotification('加载用户列表失败: ' + error.message, 'error');
        }
    }

    renderUsersTable(users, userStats) {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (users && users.length > 0) {
            users.forEach(user => {
                const row = document.createElement('tr');
                const stats = userStats[user.user_id] || {};

                // 安全处理用户数据
                const userId = user.user_id || '未知';
                const username = user.username || '--';
                const nickname = user.nickname || '--';
                const level = user.level || 1;
                const experience = user.experience || 0;
                const lastActive = user.last_active;
                const isBanned = user.is_global_banned === true;

                row.innerHTML = `
                    <td>${this.escapeHtml(userId)}</td>
                    <td>${this.escapeHtml(username)}</td>
                    <td>${this.escapeHtml(nickname)}</td>
                    <td>${level}</td>
                    <td>${experience}</td>
                    <td>${lastActive ? new Date(lastActive).toLocaleString() : '--'}</td>
                    <td>
                        ${isBanned ? 
                            '<span class="badge bg-danger">已封禁</span>' : 
                            '<span class="badge bg-success">正常</span>'
                        }
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="usersManager.viewUserDetail('${this.escapeHtml(userId)}')" title="查看详情">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${isBanned ?
                                `<button class="btn btn-outline-success" onclick="usersManager.unbanUser('${this.escapeHtml(userId)}')" title="解封用户">
                                    <i class="bi bi-unlock"></i>
                                </button>` :
                                `<button class="btn btn-outline-danger" onclick="usersManager.showBanModal('${this.escapeHtml(userId)}')" title="封禁用户">
                                    <i class="bi bi-lock"></i>
                                </button>`
                            }
                        </div>
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">暂无用户数据</td></tr>';
        }
    }

    renderPagination(total, page, pageSize) {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;

        const totalPages = Math.ceil(total / pageSize) || 1;

        pagination.innerHTML = '';

        // 上一页
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${page === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#">上一页</a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page > 1) this.loadUsers(page - 1);
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
                this.loadUsers(i);
            });
            pagination.appendChild(li);
        }

        // 下一页
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${page === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#">下一页</a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page < totalPages) this.loadUsers(page + 1);
        });
        pagination.appendChild(nextLi);
    }

    handleSearch() {
        const searchInput = document.getElementById('searchInput');
        const bannedFilter = document.getElementById('bannedFilter');
        const sortBy = document.getElementById('sortBy');
        const sortOrder = document.getElementById('sortOrder');

        // 修复搜索参数处理
        this.searchParams = {};

        if (searchInput && searchInput.value.trim()) {
            this.searchParams.search = searchInput.value.trim();
        }

        if (bannedFilter && bannedFilter.value !== '') {
            this.searchParams.banned = bannedFilter.value;
        }

        if (sortBy) {
            this.searchParams.sort_by = sortBy.value;
        }

        if (sortOrder) {
            this.searchParams.sort_order = sortOrder.value;
        }

        console.log('用户搜索参数:', this.searchParams);
        this.loadUsers(1);
    }

    async viewUserDetail(userId) {
        try {
            this.currentUserId = userId;

            const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const userDetail = await response.json();
            this.renderUserDetailModal(userDetail);

            // 设置用户ID到标题
            const title = document.getElementById('userDetailUserId');
            if (title) {
                title.textContent = userId;
            }

        } catch (error) {
            console.error('Failed to load user detail:', error);
            this.showNotification('加载用户详情失败: ' + error.message, 'error');
        }
    }

    renderUserDetailModal(userDetail) {
        const content = document.getElementById('userInfoTab');
        if (!content) return;

        const profile = userDetail.profile || {};
        const stats = userDetail.statistics || {};
        const permissions = userDetail.permissions || [];
        const groups = userDetail.groups || [];

        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>基本信息</h6>
                    <table class="table table-sm">
                        <tr><td>用户ID:</td><td>${this.escapeHtml(profile.user_id)}</td></tr>
                        <tr><td>用户名:</td><td>${this.escapeHtml(profile.username || '--')}</td></tr>
                        <tr><td>昵称:</td><td>${this.escapeHtml(profile.nickname || '--')}</td></tr>
                        <tr><td>等级:</td><td>${profile.level || 1}</td></tr>
                        <tr><td>经验值:</td><td>${profile.experience || 0}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>状态信息</h6>
                    <table class="table table-sm">
                        <tr><td>全局封禁:</td><td>${profile.is_global_banned ? '是' : '否'}</td></tr>
                        <tr><td>封禁原因:</td><td>${this.escapeHtml(profile.global_ban_reason || '--')}</td></tr>
                        <tr><td>最后活跃:</td><td>${profile.last_active ? new Date(profile.last_active).toLocaleString() : '--'}</td></tr>
                        <tr><td>注册时间:</td><td>${new Date(profile.created_at).toLocaleString()}</td></tr>
                    </table>
                </div>
            </div>
            
            ${stats.total_messages ? `
            <div class="row mt-3">
                <div class="col-12">
                    <h6>使用统计</h6>
                    <table class="table table-sm">
                        <tr><td>总消息数:</td><td>${stats.total_messages}</td></tr>
                        <tr><td>总命令数:</td><td>${stats.total_commands || 0}</td></tr>
                        <tr><td>活跃天数:</td><td>${stats.active_days || 0}</td></tr>
                        <tr><td>最后命令:</td><td>${stats.last_command ? new Date(stats.last_command).toLocaleString() : '--'}</td></tr>
                    </table>
                </div>
            </div>
            ` : ''}
            
            ${groups.length > 0 ? `
            <div class="row mt-3">
                <div class="col-12">
                    <h6>所在群组</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>群组ID</th>
                                    <th>角色</th>
                                    <th>加群时间</th>
                                    <th>最后发言</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groups.map(group => `
                                    <tr>
                                        <td>${this.escapeHtml(group.group_id)}</td>
                                        <td><span class="badge bg-secondary">${this.escapeHtml(group.role)}</span></td>
                                        <td>${group.join_time ? new Date(group.join_time).toLocaleString() : '--'}</td>
                                        <td>${group.last_speak ? new Date(group.last_speak).toLocaleString() : '--'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ` : ''}
        `;

        // 渲染权限信息
        this.renderPermissionsTab(permissions);

        // 初始化群组筛选器
        this.initGroupFilter(groups);

        // 显示模态框
        new bootstrap.Modal(document.getElementById('userDetailModal')).show();
    }

    renderPermissionsTab(permissions) {
        const content = document.getElementById('userPermissionsTab');
        if (!content) return;

        if (permissions.length > 0) {
            content.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>权限键</th>
                                <th>权限值</th>
                                <th>授权人</th>
                                <th>授权时间</th>
                                <th>过期时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${permissions.map(perm => `
                                <tr>
                                    <td>${this.escapeHtml(perm.permission_key)}</td>
                                    <td><code>${JSON.stringify(perm.permission_value)}</code></td>
                                    <td>${this.escapeHtml(perm.granted_by)}</td>
                                    <td>${new Date(perm.granted_at).toLocaleString()}</td>
                                    <td>${perm.expires_at ? new Date(perm.expires_at).toLocaleString() : '永久'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="text-center text-muted py-4"><p>暂无权限信息</p></div>';
        }
    }

    initGroupFilter(groups) {
        const groupFilter = document.getElementById('groupHistoryFilter');
        if (!groupFilter) return;

        // 清空现有选项（除了"所有群组"）
        groupFilter.innerHTML = '<option value="">所有群组</option>';

        // 添加群组选项
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.group_id;
            option.textContent = `${group.group_id} - ${group.user_name || '未知群组'}`;
            groupFilter.appendChild(option);
        });
    }

    async loadPrivateHistory(page = 1) {
        if (!this.currentUserId) return;

        this.privateHistoryPage = page;

        const startDate = document.getElementById('privateStartDate')?.value;
        const endDate = document.getElementById('privateEndDate')?.value;

        const params = new URLSearchParams({
            page: page,
            page_size: this.privateHistoryPageSize,
            user_id: this.currentUserId,
            message_type: 'private'
        });

        if (startDate) {
            params.append('start_time', new Date(startDate + 'T00:00:00').toISOString());
        }
        if (endDate) {
            params.append('end_time', new Date(endDate + 'T23:59:59').toISOString());
        }

        try {
            // 显示加载状态
            this.showPrivateHistoryLoading();

            const response = await fetch(`/api/logs/messages?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderPrivateHistory(data.logs || [], data.total || 0);
        } catch (error) {
            console.error('Failed to load private history:', error);
            this.showNotification('加载私聊历史失败: ' + error.message, 'error');
            this.showPrivateHistoryError();
        }
    }

    async loadGroupHistory(page = 1) {
        if (!this.currentUserId) return;

        this.groupHistoryPage = page;

        const groupId = document.getElementById('groupHistoryFilter')?.value;
        const startDate = document.getElementById('groupStartDate')?.value;
        const endDate = document.getElementById('groupEndDate')?.value;

        const params = new URLSearchParams({
            page: page,
            page_size: this.groupHistoryPageSize,
            user_id: this.currentUserId,
            message_type: 'group'
        });

        if (groupId) {
            params.append('group_id', groupId);
        }
        if (startDate) {
            params.append('start_time', new Date(startDate + 'T00:00:00').toISOString());
        }
        if (endDate) {
            params.append('end_time', new Date(endDate + 'T23:59:59').toISOString());
        }

        try {
            // 显示加载状态
            this.showGroupHistoryLoading();

            const response = await fetch(`/api/logs/messages?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderGroupHistory(data.logs || [], data.total || 0);
        } catch (error) {
            console.error('Failed to load group history:', error);
            this.showNotification('加载群聊历史失败: ' + error.message, 'error');
            this.showGroupHistoryError();
        }
    }

    showPrivateHistoryLoading() {
        const content = document.getElementById('privateHistoryContent');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-message">
                <div class="spinner-border text-primary loading-spinner" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
                <p>正在加载私聊消息...</p>
            </div>
        `;
    }

    showGroupHistoryLoading() {
        const content = document.getElementById('groupHistoryContent');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-message">
                <div class="spinner-border text-primary loading-spinner" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
                <p>正在加载群聊消息...</p>
            </div>
        `;
    }

    showPrivateHistoryError() {
        const content = document.getElementById('privateHistoryContent');
        if (!content) return;

        content.innerHTML = `
            <div class="empty-message">
                <i class="bi bi-exclamation-triangle" style="font-size: 2rem;"></i>
                <p class="mt-2">加载失败，请重试</p>
            </div>
        `;
    }

    showGroupHistoryError() {
        const content = document.getElementById('groupHistoryContent');
        if (!content) return;

        content.innerHTML = `
            <div class="empty-message">
                <i class="bi bi-exclamation-triangle" style="font-size: 2rem;"></i>
                <p class="mt-2">加载失败，请重试</p>
            </div>
        `;
    }

    renderPrivateHistory(messages, total) {
        const content = document.getElementById('privateHistoryContent');
        if (!content) return;

        if (messages && messages.length > 0) {
            content.innerHTML = messages.map(message => `
                <div class="message-item message-private">
                    <div class="message-header">
                        <span class="message-time">${new Date(message.timestamp).toLocaleString()}</span>
                        <span class="message-type-badge badge-private">私聊</span>
                    </div>
                    <div class="message-content">${this.escapeHtml(message.message_content || '')}</div>
                    <div class="message-actions">
                        <button class="message-action-btn" onclick="usersManager.copyMessage('${this.escapeHtml(message.message_content || '')}')">
                            <i class="bi bi-clipboard"></i> 复制
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            content.innerHTML = `
                <div class="empty-message">
                    <i class="bi bi-chat-dots" style="font-size: 2rem;"></i>
                    <p class="mt-2">暂无私聊消息记录</p>
                </div>
            `;
        }

        this.renderHistoryPagination('privateHistoryPagination', total, this.privateHistoryPage, this.privateHistoryPageSize, 'loadPrivateHistory');
    }

    renderGroupHistory(messages, total) {
        const content = document.getElementById('groupHistoryContent');
        if (!content) return;

        if (messages && messages.length > 0) {
            content.innerHTML = messages.map(message => `
                <div class="message-item message-group-chat">
                    <div class="message-header">
                        <span class="message-time">${new Date(message.timestamp).toLocaleString()}</span>
                        <div>
                            <span class="message-group">群组: ${this.escapeHtml(message.group_id)}</span>
                            <span class="message-type-badge badge-group ms-1">群聊</span>
                        </div>
                    </div>
                    <div class="message-content">${this.escapeHtml(message.message_content || '')}</div>
                    <div class="message-actions">
                        <button class="message-action-btn" onclick="usersManager.copyMessage('${this.escapeHtml(message.message_content || '')}')">
                            <i class="bi bi-clipboard"></i> 复制
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            content.innerHTML = `
                <div class="empty-message">
                    <i class="bi bi-people" style="font-size: 2rem;"></i>
                    <p class="mt-2">暂无群聊消息记录</p>
                </div>
            `;
        }

        this.renderHistoryPagination('groupHistoryPagination', total, this.groupHistoryPage, this.groupHistoryPageSize, 'loadGroupHistory');
    }

    renderHistoryPagination(paginationId, total, page, pageSize, loadFunction) {
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
            if (page > 1) this[loadFunction](page - 1);
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
                this[loadFunction](i);
            });
            pagination.appendChild(li);
        }

        // 下一页
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${page === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#">下一页</a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page < totalPages) this[loadFunction](page + 1);
        });
        pagination.appendChild(nextLi);

        // 显示总数信息
        if (total > 0) {
            const infoLi = document.createElement('li');
            infoLi.className = 'page-item disabled';
            infoLi.innerHTML = `<span class="page-link border-0">共 ${total} 条</span>`;
            pagination.appendChild(infoLi);
        }
    }

    // 复制消息内容
    copyMessage(content) {
        navigator.clipboard.writeText(content).then(() => {
            this.showNotification('消息内容已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('复制失败:', err);
            this.showNotification('复制失败', 'error');
        });
    }

    showBanModal(userId) {
        const userIdInput = document.getElementById('banUserId');
        const reasonInput = document.getElementById('banReason');
        const durationInput = document.getElementById('banDuration');

        if (userIdInput) userIdInput.value = userId;
        if (reasonInput) reasonInput.value = '';
        if (durationInput) durationInput.value = '';

        new bootstrap.Modal(document.getElementById('banUserModal')).show();
    }

    async confirmBan() {
        const userId = document.getElementById('banUserId')?.value;
        const reason = document.getElementById('banReason')?.value;
        const duration = document.getElementById('banDuration')?.value;

        if (!userId) {
            this.showNotification('用户ID不能为空', 'error');
            return;
        }

        try {
            let url = `/api/users/${encodeURIComponent(userId)}/ban`;
            const params = new URLSearchParams();

            if (reason) {
                params.append('reason', reason);
            }
            if (duration) {
                params.append('duration_days', duration);
            }

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户封禁成功', 'success');
                bootstrap.Modal.getInstance(document.getElementById('banUserModal')).hide();
                this.loadUsers(this.currentPage);
            } else {
                this.showNotification(result.message || '封禁失败', 'error');
            }
        } catch (error) {
            console.error('Failed to ban user:', error);
            this.showNotification('封禁操作失败: ' + error.message, 'error');
        }
    }

    async unbanUser(userId) {
        if (!confirm('确定要解封这个用户吗？')) return;

        try {
            const response = await fetch(`/api/users/${encodeURIComponent(userId)}/unban`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户解封成功', 'success');
                this.loadUsers(this.currentPage);
            } else {
                this.showNotification(result.message || '解封失败', 'error');
            }
        } catch (error) {
            console.error('Failed to unban user:', error);
            this.showNotification('解封操作失败: ' + error.message, 'error');
        }
    }

    async loadUserStats() {
        try {
            const response = await fetch('/api/users/stats', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const stats = await response.json();
            this.renderUserStatsModal(stats);
        } catch (error) {
            console.error('Failed to load user stats:', error);
            this.showNotification('加载用户统计失败: ' + error.message, 'error');
        }
    }

    renderUserStatsModal(stats) {
        const content = document.getElementById('userStatsContent');
        if (!content) return;

        content.innerHTML = `
            <div class="row text-center">
                <div class="col-md-3 mb-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body">
                            <h3>${stats.total_users || 0}</h3>
                            <p class="mb-0">总用户数</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card bg-success text-white">
                        <div class="card-body">
                            <h3>${stats.active_users || 0}</h3>
                            <p class="mb-0">活跃用户</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card bg-danger text-white">
                        <div class="card-body">
                            <h3>${stats.banned_users || 0}</h3>
                            <p class="mb-0">封禁用户</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card bg-info text-white">
                        <div class="card-body">
                            <h3>${stats.new_today || 0}</h3>
                            <p class="mb-0">今日新增</p>
                        </div>
                    </div>
                </div>
            </div>
            ${stats.active_rate !== undefined ? `
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h6>活跃率</h6>
                            <div class="progress">
                                <div class="progress-bar bg-success" role="progressbar" 
                                     style="width: ${stats.active_rate}%" 
                                     aria-valuenow="${stats.active_rate}" 
                                     aria-valuemin="0" 
                                     aria-valuemax="100">
                                    ${stats.active_rate}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        `;

        new bootstrap.Modal(document.getElementById('userStatsModal')).show();
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
const usersManager = new UsersManager();