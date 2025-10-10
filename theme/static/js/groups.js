class GroupsManager {
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

        this.loadGroups();
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
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        document.getElementById('enabledFilter')?.addEventListener('change', () => this.handleSearch());

        // 刷新按钮
        document.getElementById('refreshGroupsBtn')?.addEventListener('click', () => this.loadGroups());
    }

    async loadGroups(page = 1) {
        this.currentPage = page;

        const params = new URLSearchParams({
            page: page,
            page_size: this.pageSize,
            ...this.searchParams
        });

        try {
            const response = await fetch(`/api/groups?${params}`, {
                credentials: 'include'
            });
            const data = await response.json();

            this.renderGroupsTable(data.groups);
            this.renderPagination(data.total, data.page, data.page_size);
        } catch (error) {
            console.error('Failed to load groups:', error);
            this.showNotification('加载群组列表失败', 'error');
        }
    }

    renderGroupsTable(groups) {
        const tbody = document.querySelector('#groupsTable tbody');
        tbody.innerHTML = '';

        if (groups && groups.length > 0) {
            groups.forEach(group => {
                const row = document.createElement('tr');

                row.innerHTML = `
                    <td>${group.group_id}</td>
                    <td>${group.group_name || `群${group.group_id}`}</td>
                    <td>${group.current_users || 0}/${group.max_users || 500}</td>
                    <td>${group.last_active ? new Date(group.last_active).toLocaleString() : '--'}</td>
                    <td>
                        ${group.is_enabled ? 
                            '<span class="badge bg-success">已启用</span>' : 
                            '<span class="badge bg-danger">已禁用</span>'
                        }
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="groupsManager.viewGroupDetail('${group.group_id}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${group.is_enabled ?
                                `<button class="btn btn-outline-warning" onclick="groupsManager.disableGroup('${group.group_id}')">
                                    <i class="bi bi-pause"></i>
                                </button>` :
                                `<button class="btn btn-outline-success" onclick="groupsManager.enableGroup('${group.group_id}')">
                                    <i class="bi bi-play"></i>
                                </button>`
                            }
                        </div>
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无群组数据</td></tr>';
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
            if (page > 1) this.loadGroups(page - 1);
        });
        pagination.appendChild(prevLi);

        // 页码
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === page ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadGroups(i);
            });
            pagination.appendChild(li);
        }

        // 下一页
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${page === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#">下一页</a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page < totalPages) this.loadGroups(page + 1);
        });
        pagination.appendChild(nextLi);
    }

    handleSearch() {
        this.searchParams = {
            search: document.getElementById('searchInput').value,
            enabled: document.getElementById('enabledFilter').value || undefined
        };

        this.loadGroups(1);
    }

    async viewGroupDetail(groupId) {
        try {
            const [groupDetail, groupUsers] = await Promise.all([
                fetch(`/api/groups/${groupId}`, { credentials: 'include' }).then(r => r.json()),
                fetch(`/api/groups/${groupId}/users?page_size=10`, { credentials: 'include' }).then(r => r.json())
            ]);

            this.renderGroupDetailModal(groupDetail, groupUsers);
        } catch (error) {
            console.error('Failed to load group detail:', error);
            this.showNotification('加载群组详情失败', 'error');
        }
    }

    renderGroupDetailModal(groupDetail, groupUsers) {
        document.getElementById('groupDetailTitle').textContent = groupDetail.group_name || `群${groupDetail.group_id}`;

        // 基本信息标签页
        document.getElementById('groupInfoTab').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>基本信息</h6>
                    <table class="table table-sm">
                        <tr><td>群组ID:</td><td>${groupDetail.group_id}</td></tr>
                        <tr><td>群组名称:</td><td>${groupDetail.group_name || '--'}</td></tr>
                        <tr><td>群备注:</td><td>${groupDetail.group_memo || '--'}</td></tr>
                        <tr><td>成员数量:</td><td>${groupDetail.current_users || 0}/${groupDetail.max_users || 500}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>状态信息</h6>
                    <table class="table table-sm">
                        <tr><td>启用状态:</td><td>${groupDetail.is_enabled ? '已启用' : '已禁用'}</td></tr>
                        <tr><td>创建时间:</td><td>${groupDetail.created_time ? new Date(groupDetail.created_time).toLocaleString() : '--'}</td></tr>
                        <tr><td>最后活动:</td><td>${groupDetail.last_active ? new Date(groupDetail.last_active).toLocaleString() : '--'}</td></tr>
                        <tr><td>注册时间:</td><td>${new Date(groupDetail.created_at).toLocaleString()}</td></tr>
                    </table>
                </div>
            </div>
        `;

        // 成员管理标签页
        let membersHtml = '<p class="text-muted">暂无成员数据</p>';
        if (groupUsers.users && groupUsers.users.length > 0) {
            membersHtml = `
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>用户ID</th>
                                <th>用户名</th>
                                <th>角色</th>
                                <th>消息数</th>
                                <th>最后发言</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groupUsers.users.map(user => `
                                <tr>
                                    <td>${user.user_id}</td>
                                    <td>${user.user_name || '--'}</td>
                                    <td><span class="badge bg-secondary">${user.role}</span></td>
                                    <td>${user.message_count}</td>
                                    <td>${user.last_speak ? new Date(user.last_speak).toLocaleString() : '--'}</td>
                                    <td>
                                        ${user.is_banned ? 
                                            '<span class="badge bg-danger">已封禁</span>' : 
                                            '<span class="badge bg-success">正常</span>'
                                        }
                                    </td>
                                    <td>
                                        <div class="btn-group btn-group-sm">
                                            ${user.is_banned ?
                                                `<button class="btn btn-outline-success btn-sm" onclick="groupsManager.unbanUser('${groupDetail.group_id}', '${user.user_id}')">
                                                    解封
                                                </button>` :
                                                `<button class="btn btn-outline-danger btn-sm" onclick="groupsManager.banUser('${groupDetail.group_id}', '${user.user_id}')">
                                                    封禁
                                                </button>`
                                            }
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        document.getElementById('groupMembersTab').innerHTML = membersHtml;

        new bootstrap.Modal(document.getElementById('groupDetailModal')).show();
    }

    async enableGroup(groupId) {
        try {
            const response = await fetch(`/api/groups/${groupId}/enable`, {
                method: 'POST',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('群组已启用', 'success');
                this.loadGroups(this.currentPage);
            } else {
                this.showNotification(result.message || '启用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to enable group:', error);
            this.showNotification('启用操作失败', 'error');
        }
    }

    async disableGroup(groupId) {
        if (!confirm('确定要禁用这个群组吗？机器人将不再响应该群组的消息。')) return;

        try {
            const response = await fetch(`/api/groups/${groupId}/disable`, {
                method: 'POST',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('群组已禁用', 'success');
                this.loadGroups(this.currentPage);
            } else {
                this.showNotification(result.message || '禁用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to disable group:', error);
            this.showNotification('禁用操作失败', 'error');
        }
    }

    async banUser(groupId, userId) {
        const reason = prompt('请输入封禁原因:');
        if (reason === null) return;

        try {
            const response = await fetch(`/api/groups/${groupId}/users/${userId}/ban?reason=${encodeURIComponent(reason)}`, {
                method: 'POST',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户已封禁', 'success');
                // 刷新当前视图
                this.viewGroupDetail(groupId);
            } else {
                this.showNotification(result.message || '封禁失败', 'error');
            }
        } catch (error) {
            console.error('Failed to ban user:', error);
            this.showNotification('封禁操作失败', 'error');
        }
    }

    async unbanUser(groupId, userId) {
        try {
            const response = await fetch(`/api/groups/${groupId}/users/${userId}/unban`, {
                method: 'POST',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户已解封', 'success');
                // 刷新当前视图
                this.viewGroupDetail(groupId);
            } else {
                this.showNotification(result.message || '解封失败', 'error');
            }
        } catch (error) {
            console.error('Failed to unban user:', error);
            this.showNotification('解封操作失败', 'error');
        }
    }

    showNotification(message, type = 'info') {
        if (window.dashboardManager) {
            window.dashboardManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// 全局实例
const groupsManager = new GroupsManager();