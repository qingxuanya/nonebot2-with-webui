class UsersManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.searchParams = {};
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
        // 搜索功能
        document.getElementById('searchBtn')?.addEventListener('click', () => this.handleSearch());

        // 输入框回车搜索
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // 筛选条件变化
        ['#bannedFilter', '#sortBy', '#sortOrder'].forEach(selector => {
            document.querySelector(selector)?.addEventListener('change', () => this.handleSearch());
        });
    }

    async loadUsers(page = 1) {
        this.currentPage = page;

        const params = new URLSearchParams({
            page: page,
            page_size: this.pageSize,
            ...this.searchParams
        });

        try {
            const response = await fetch(`/api/users?${params}`, {
                credentials: 'include'
            });
            const data = await response.json();

            this.renderUsersTable(data.users, data.user_stats);
            this.renderPagination(data.total, data.page, data.page_size);
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showNotification('加载用户列表失败', 'error');
        }
    }

    renderUsersTable(users, userStats) {
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';

        if (users && users.length > 0) {
            users.forEach(user => {
                const stats = userStats[user.user_id] || {};
                const row = document.createElement('tr');

                row.innerHTML = `
                    <td>${user.user_id}</td>
                    <td>${user.username || '--'}</td>
                    <td>${user.nickname || '--'}</td>
                    <td>${user.level}</td>
                    <td>${user.experience}</td>
                    <td>${user.last_active ? new Date(user.last_active).toLocaleString() : '--'}</td>
                    <td>
                        ${user.is_global_banned ? 
                            '<span class="badge bg-danger">已封禁</span>' : 
                            '<span class="badge bg-success">正常</span>'
                        }
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="usersManager.viewUserDetail('${user.user_id}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${user.is_global_banned ?
                                `<button class="btn btn-outline-success" onclick="usersManager.unbanUser('${user.user_id}')">
                                    <i class="bi bi-unlock"></i>
                                </button>` :
                                `<button class="btn btn-outline-danger" onclick="usersManager.showBanModal('${user.user_id}')">
                                    <i class="bi bi-lock"></i>
                                </button>`
                            }
                        </div>
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">暂无用户数据</td></tr>';
        }
    }

    renderPagination(total, page, pageSize) {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(total / pageSize);

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
        for (let i = 1; i <= totalPages; i++) {
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
        this.searchParams = {
            search: document.getElementById('searchInput').value,
            banned: document.getElementById('bannedFilter').value || undefined,
            sort_by: document.getElementById('sortBy').value,
            sort_order: document.getElementById('sortOrder').value
        };

        this.loadUsers(1);
    }

    async viewUserDetail(userId) {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                credentials: 'include'
            });
            const userDetail = await response.json();

            this.renderUserDetailModal(userDetail);
        } catch (error) {
            console.error('Failed to load user detail:', error);
            this.showNotification('加载用户详情失败', 'error');
        }
    }

    renderUserDetailModal(userDetail) {
        const content = document.getElementById('userDetailContent');
        const profile = userDetail.profile;
        const stats = userDetail.statistics;

        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>基本信息</h6>
                    <table class="table table-sm">
                        <tr><td>用户ID:</td><td>${profile.user_id}</td></tr>
                        <tr><td>用户名:</td><td>${profile.username || '--'}</td></tr>
                        <tr><td>昵称:</td><td>${profile.nickname || '--'}</td></tr>
                        <tr><td>等级:</td><td>${profile.level}</td></tr>
                        <tr><td>经验值:</td><td>${profile.experience}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>状态信息</h6>
                    <table class="table table-sm">
                        <tr><td>全局封禁:</td><td>${profile.is_global_banned ? '是' : '否'}</td></tr>
                        <tr><td>封禁原因:</td><td>${profile.global_ban_reason || '--'}</td></tr>
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
            
            ${userDetail.groups && userDetail.groups.length > 0 ? `
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
                                ${userDetail.groups.map(group => `
                                    <tr>
                                        <td>${group.group_id}</td>
                                        <td>${group.role}</td>
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

        new bootstrap.Modal(document.getElementById('userDetailModal')).show();
    }

    showBanModal(userId) {
        document.getElementById('banUserId').value = userId;
        document.getElementById('banReason').value = '';
        document.getElementById('banDuration').value = '';
        new bootstrap.Modal(document.getElementById('banUserModal')).show();
    }

    async confirmBan() {
        const userId = document.getElementById('banUserId').value;
        const reason = document.getElementById('banReason').value;
        const duration = document.getElementById('banDuration').value;

        try {
            let url = `/api/users/${userId}/ban`;
            if (reason) url += `?reason=${encodeURIComponent(reason)}`;
            if (duration) url += `${reason ? '&' : '?'}duration_days=${duration}`;

            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include'
            });

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
            this.showNotification('封禁操作失败', 'error');
        }
    }

    async unbanUser(userId) {
        if (!confirm('确定要解封这个用户吗？')) return;

        try {
            const response = await fetch(`/api/users/${userId}/unban`, {
                method: 'POST',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户解封成功', 'success');
                this.loadUsers(this.currentPage);
            } else {
                this.showNotification(result.message || '解封失败', 'error');
            }
        } catch (error) {
            console.error('Failed to unban user:', error);
            this.showNotification('解封操作失败', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // 复用Dashboard的通知方法
        if (window.dashboardManager) {
            window.dashboardManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// 全局实例
const usersManager = new UsersManager();

// 确认封禁按钮事件
document.getElementById('confirmBanBtn')?.addEventListener('click', () => {
    usersManager.confirmBan();
});