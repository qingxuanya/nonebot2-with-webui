class GroupsManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.searchParams = {};
        this.currentGroupId = null;
        this.groupPluginsPage = 1;
        this.groupPluginsPageSize = 20;
        this.groupPluginsSearchParams = {};
        this.init();
    }

    async init() {
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
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        const enabledFilter = document.getElementById('enabledFilter');
        const refreshBtn = document.getElementById('refreshGroupsBtn');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }

        if (enabledFilter) {
            enabledFilter.addEventListener('change', () => this.handleSearch());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadGroups());
        }

        const groupDetailTabs = document.getElementById('groupDetailTabs');
        if (groupDetailTabs) {
            groupDetailTabs.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('href');
                this.handleGroupDetailTabChange(target);
            });
        }
    }

    handleGroupDetailTabChange(target) {
        switch (target) {
            case '#groupPluginsTab':
                this.loadGroupPlugins();
                break;
        }
    }

    async loadGroups(page = 1) {
        this.currentPage = page;

        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', this.pageSize);

        if (this.searchParams.search) {
            params.append('search', this.searchParams.search);
        }
        if (this.searchParams.enabled !== undefined && this.searchParams.enabled !== '') {
            params.append('enabled', this.searchParams.enabled);
        }

        try {
            const response = await fetch(`/api/groups?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderGroupsTable(data.groups || []);
            this.renderPagination(data.total || 0, data.page || 1, data.page_size || this.pageSize);
        } catch (error) {
            console.error('Failed to load groups:', error);
            this.showNotification('加载群组列表失败: ' + error.message, 'error');
        }
    }

    renderGroupsTable(groups) {
        const tbody = document.querySelector('#groupsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (groups && groups.length > 0) {
            groups.forEach(group => {
                const row = document.createElement('tr');
                const groupId = group.group_id || '未知';
                const groupName = this.getGroupDisplayName(group);
                const currentUsers = group.current_users || 0;
                const maxUsers = group.max_users || 500;
                const lastActive = group.last_active;
                const isEnabled = group.is_enabled !== false;

                row.innerHTML = `
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${this.getGroupAvatar(groupId)}" 
                                 class="rounded me-2" 
                                 style="width: 32px; height: 32px; object-fit: cover;"
                                 alt="${this.escapeHtml(groupName)}"
                                 onerror="this.src='https://via.placeholder.com/32/007bff/ffffff?text=G'">
                            <div>
                                <div class="fw-bold">${this.escapeHtml(groupId)}</div>
                                <small class="text-muted">${this.escapeHtml(groupName)}</small>
                            </div>
                        </div>
                    </td>
                    <td>${this.escapeHtml(groupName)}</td>
                    <td>
                        <span class="badge bg-info">${currentUsers}/${maxUsers}</span>
                    </td>
                    <td>${lastActive ? new Date(lastActive).toLocaleString() : '--'}</td>
                    <td>
                        ${isEnabled ? 
                            '<span class="badge bg-success">已启用</span>' : 
                            '<span class="badge bg-danger">已禁用</span>'
                        }
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="groupsManager.viewGroupDetail('${this.escapeHtml(groupId)}')" title="查看详情">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${isEnabled ?
                                `<button class="btn btn-outline-warning" onclick="groupsManager.disableGroup('${this.escapeHtml(groupId)}')" title="禁用群组">
                                    <i class="bi bi-pause"></i>
                                </button>` :
                                `<button class="btn btn-outline-success" onclick="groupsManager.enableGroup('${this.escapeHtml(groupId)}')" title="启用群组">
                                    <i class="bi bi-play"></i>
                                </button>`
                            }
                        </div>
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无群组数据</td></tr>';
        }
    }

    getGroupDisplayName(group) {
        if (group.group_memo && group.group_memo.trim()) {
            return group.group_memo;
        } else if (group.group_name && group.group_name.trim()) {
            return group.group_name;
        } else {
            return `群${group.group_id}`;
        }
    }

    getGroupAvatar(groupId) {
        return `https://p.qlogo.cn/gh/${groupId}/${groupId}/0`;
    }

    renderPagination(total, page, pageSize) {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;

        const totalPages = Math.ceil(total / pageSize) || 1;

        pagination.innerHTML = '';

        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${page === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#">上一页</a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page > 1) this.loadGroups(page - 1);
        });
        pagination.appendChild(prevLi);

        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === page ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadGroups(i);
            });
            pagination.appendChild(li);
        }

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
        const searchInput = document.getElementById('searchInput');
        const enabledFilter = document.getElementById('enabledFilter');

        this.searchParams = {};

        if (searchInput && searchInput.value.trim()) {
            this.searchParams.search = searchInput.value.trim();
        }

        if (enabledFilter && enabledFilter.value !== '') {
            this.searchParams.enabled = enabledFilter.value;
        }

        this.loadGroups(1);
    }

    async viewGroupDetail(groupId) {
        try {
            this.currentGroupId = groupId;

            const [groupDetail, groupUsers] = await Promise.all([
                fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
                    credentials: 'include'
                }).then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                }),
                fetch(`/api/groups/${encodeURIComponent(groupId)}/users?page_size=10`, {
                    credentials: 'include'
                }).then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                })
            ]);

            this.renderGroupDetailModal(groupDetail, groupUsers);
        } catch (error) {
            console.error('Failed to load group detail:', error);
            this.showNotification('加载群组详情失败: ' + error.message, 'error');
        }
    }

    renderGroupDetailModal(groupDetail, groupUsers) {
        const title = document.getElementById('groupDetailTitle');
        if (title) {
            const groupName = this.getGroupDisplayName(groupDetail);
            title.textContent = `群组详情 - ${this.escapeHtml(groupName)}`;
        }

        const infoTab = document.getElementById('groupInfoTab');
        if (infoTab) {
            const groupName = this.getGroupDisplayName(groupDetail);

            infoTab.innerHTML = `
                <div class="row">
                    <div class="col-md-4 text-center mb-3">
                        <img src="${this.getGroupAvatar(groupDetail.group_id)}" 
                             class="rounded mb-2" 
                             style="width: 100px; height: 100px; object-fit: cover;"
                             alt="${this.escapeHtml(groupName)}"
                             onerror="this.src='https://via.placeholder.com/100/007bff/ffffff?text=G'">
                        <h5 class="mt-2">${this.escapeHtml(groupName)}</h5>
                        <p class="text-muted">ID: ${this.escapeHtml(groupDetail.group_id)}</p>
                    </div>
                    <div class="col-md-8">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>基本信息</h6>
                                <table class="table table-sm">
                                    <tr><td>群组ID:</td><td>${this.escapeHtml(groupDetail.group_id)}</td></tr>
                                    <tr><td>群组名称:</td><td>${this.escapeHtml(groupDetail.group_name || '--')}</td></tr>
                                    <tr><td>群备注:</td><td>${this.escapeHtml(groupDetail.group_memo || '--')}</td></tr>
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
                    </div>
                </div>
            `;
        }

        this.renderGroupMembersTab(groupDetail, groupUsers);
        this.renderGroupPluginsTab(groupDetail);

        new bootstrap.Modal(document.getElementById('groupDetailModal')).show();
    }

    renderGroupMembersTab(groupDetail, groupUsers) {
        const membersTab = document.getElementById('groupMembersTab');
        if (!membersTab) return;

        let membersHtml = '<p class="text-muted">暂无成员数据</p>';
        if (groupUsers.users && groupUsers.users.length > 0) {
            membersHtml = `
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>用户</th>
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
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <img src="https://q1.qlogo.cn/g?b=qq&nk=${user.user_id}&s=100" 
                                                 class="rounded me-2" 
                                                 style="width: 32px; height: 32px; object-fit: cover;"
                                                 alt="${this.escapeHtml(user.user_name || '')}"
                                                 onerror="this.src='https://via.placeholder.com/32/6c757d/ffffff?text=U'">
                                            <div>
                                                <div class="fw-bold">${this.escapeHtml(user.user_id)}</div>
                                                <small class="text-muted">${this.escapeHtml(user.user_name || '--')}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="badge ${this.getRoleBadgeClass(user.role)}">${this.escapeHtml(user.role)}</span>
                                    </td>
                                    <td>${user.message_count || 0}</td>
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
                                                `<button class="btn btn-outline-success btn-sm" onclick="groupsManager.unbanUser('${this.escapeHtml(groupDetail.group_id)}', '${this.escapeHtml(user.user_id)}')">
                                                    解封
                                                </button>` :
                                                `<button class="btn btn-outline-danger btn-sm" onclick="groupsManager.banUser('${this.escapeHtml(groupDetail.group_id)}', '${this.escapeHtml(user.user_id)}')">
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
        membersTab.innerHTML = membersHtml;
    }

    renderGroupPluginsTab(groupDetail) {
        const pluginsTab = document.getElementById('groupPluginsTab');
        if (!pluginsTab) return;

        pluginsTab.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h6 class="card-title mb-0">群组插件设置</h6>
                </div>
                <div class="card-body">
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i>
                        在这里管理该群组的插件启用状态
                    </div>
                    
                    <div class="mb-3">
                        <div class="row g-2">
                            <div class="col-md-6">
                                <input type="text" class="form-control" id="pluginSearchInput" placeholder="搜索插件名称或描述...">
                            </div>
                            <div class="col-md-3">
                                <select class="form-select" id="pluginStatusFilter">
                                    <option value="">全部状态</option>
                                    <option value="enabled">已启用</option>
                                    <option value="disabled">已禁用</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <button class="btn btn-primary w-100" onclick="groupsManager.searchGroupPlugins()">
                                    <i class="bi bi-search"></i> 搜索
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="groupPluginsLoading" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                        <p class="mt-2">正在加载插件列表...</p>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>插件名称</th>
                                    <th>描述</th>
                                    <th>全局状态</th>
                                    <th>群组状态</th>
                                    <th>使用次数</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="groupPluginsTableBody">
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-3">
                        <nav aria-label="插件分页">
                            <ul class="pagination justify-content-center" id="groupPluginsPagination">
                            </ul>
                        </nav>
                    </div>
                </div>
            </div>
        `;

        this.loadGroupPlugins();
    }

    getRoleBadgeClass(role) {
        const roleClasses = {
            'owner': 'bg-danger',
            'admin': 'bg-warning',
            'member': 'bg-secondary'
        };
        return roleClasses[role] || 'bg-secondary';
    }

    async loadGroupPlugins(page = 1) {
        if (!this.currentGroupId) return;

        this.groupPluginsPage = page;

        try {
            this.showGroupPluginsLoading();

            const params = new URLSearchParams({
                page: page,
                page_size: this.groupPluginsPageSize
            });

            if (this.groupPluginsSearchParams.search) {
                params.append('search', this.groupPluginsSearchParams.search);
            }
            if (this.groupPluginsSearchParams.enabled !== undefined) {
                params.append('enabled', this.groupPluginsSearchParams.enabled);
            }

            const [pluginsResponse, settingsResponse] = await Promise.all([
                fetch(`/api/plugins?${params}`, {
                    credentials: 'include'
                }),
                this.loadGroupPluginSettings(this.currentGroupId)
            ]);

            if (!pluginsResponse.ok) {
                throw new Error(`HTTP error! status: ${pluginsResponse.status}`);
            }

            const pluginsData = await pluginsResponse.json();
            const plugins = pluginsData.plugins || [];
            const groupSettings = await settingsResponse;

            const mergedPlugins = plugins.map(plugin => {
                const groupSetting = groupSettings.find(setting =>
                    setting.plugin_name === plugin.plugin_name
                );

                const isGroupEnabled = groupSetting ?
                    groupSetting.is_enabled :
                    plugin.is_global_enabled;

                const groupUsageCount = groupSetting ?
                    groupSetting.usage_count :
                    0;

                return {
                    ...plugin,
                    is_group_enabled: isGroupEnabled,
                    group_usage_count: groupUsageCount,
                    has_custom_setting: !!groupSetting && groupSetting.is_enabled !== plugin.is_global_enabled
                };
            });

            this.renderGroupPluginsTable(mergedPlugins, pluginsData.total || 0);
        } catch (error) {
            console.error('Failed to load group plugins:', error);
            this.showNotification('加载群组插件失败: ' + error.message, 'error');
            this.showGroupPluginsError();
        }
    }

    async loadGroupPluginSettings(groupId) {
        try {
            const response = await fetch(`/api/plugins/groups/${encodeURIComponent(groupId)}/settings`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                return data.settings || [];
            }
            return [];
        } catch (error) {
            console.error('Failed to load group plugin settings:', error);
            return [];
        }
    }

    showGroupPluginsLoading() {
        const loadingElement = document.getElementById('groupPluginsLoading');
        const tableBody = document.getElementById('groupPluginsTableBody');

        if (loadingElement) loadingElement.style.display = 'block';
        if (tableBody) tableBody.innerHTML = '';
    }

    showGroupPluginsError() {
        const loadingElement = document.getElementById('groupPluginsLoading');
        const tableBody = document.getElementById('groupPluginsTableBody');

        if (loadingElement) loadingElement.style.display = 'none';
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-exclamation-triangle"></i>
                        <p class="mt-2">加载失败，请重试</p>
                    </td>
                </tr>
            `;
        }
    }

    renderGroupPluginsTable(plugins, total) {
        const loadingElement = document.getElementById('groupPluginsLoading');
        const tableBody = document.getElementById('groupPluginsTableBody');

        if (loadingElement) loadingElement.style.display = 'none';
        if (!tableBody) return;

        if (plugins && plugins.length > 0) {
            tableBody.innerHTML = plugins.map(plugin => `
                <tr>
                    <td>
                        <div>
                            <div class="fw-bold">${this.escapeHtml(plugin.display_name || plugin.plugin_name)}</div>
                            <small class="text-muted">${this.escapeHtml(plugin.plugin_name)}</small>
                            ${plugin.has_custom_setting ? 
                                '<br><small class="text-warning"><i class="bi bi-gear-fill"></i> 自定义设置</small>' : 
                                ''
                            }
                        </div>
                    </td>
                    <td>
                        <div class="text-truncate" style="max-width: 200px;" title="${this.escapeHtml(plugin.description || '')}">
                            ${this.escapeHtml(plugin.description || '暂无描述')}
                        </div>
                    </td>
                    <td>
                        ${plugin.is_global_enabled ? 
                            '<span class="badge bg-success">已启用</span>' : 
                            '<span class="badge bg-danger">已禁用</span>'
                        }
                    </td>
                    <td>
                        ${plugin.is_group_enabled ? 
                            '<span class="badge bg-success">已启用</span>' : 
                            '<span class="badge bg-danger">已禁用</span>'
                        }
                        ${plugin.is_group_enabled !== plugin.is_global_enabled ? 
                            '<br><small class="text-warning">与全局不同</small>' : 
                            ''
                        }
                    </td>
                    <td>
                        <span class="badge bg-info">${plugin.group_usage_count || 0}</span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            ${plugin.is_group_enabled ?
                                `<button class="btn btn-outline-warning" onclick="groupsManager.disableGroupPlugin('${this.escapeHtml(plugin.plugin_name)}')" title="在群组中禁用">
                                    <i class="bi bi-pause"></i> 禁用
                                </button>` :
                                `<button class="btn btn-outline-success" onclick="groupsManager.enableGroupPlugin('${this.escapeHtml(plugin.plugin_name)}')" title="在群组中启用">
                                    <i class="bi bi-play"></i> 启用
                                </button>`
                            }
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-puzzle"></i>
                        <p class="mt-2">暂无插件数据</p>
                    </td>
                </tr>
            `;
        }

        this.renderGroupPluginsPagination(total, this.groupPluginsPage, this.groupPluginsPageSize);
    }

    renderGroupPluginsPagination(total, page, pageSize) {
        const pagination = document.getElementById('groupPluginsPagination');
        if (!pagination) return;

        const totalPages = Math.ceil(total / pageSize) || 1;

        pagination.innerHTML = '';

        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${page === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#">上一页</a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page > 1) this.loadGroupPlugins(page - 1);
        });
        pagination.appendChild(prevLi);

        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === page ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadGroupPlugins(i);
            });
            pagination.appendChild(li);
        }

        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${page === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#">下一页</a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page < totalPages) this.loadGroupPlugins(page + 1);
        });
        pagination.appendChild(nextLi);
    }

    searchGroupPlugins() {
        const searchInput = document.getElementById('pluginSearchInput');
        const statusFilter = document.getElementById('pluginStatusFilter');

        this.groupPluginsSearchParams = {};

        if (searchInput && searchInput.value.trim()) {
            this.groupPluginsSearchParams.search = searchInput.value.trim();
        }

        if (statusFilter && statusFilter.value) {
            this.groupPluginsSearchParams.enabled = statusFilter.value === 'enabled';
        }

        this.loadGroupPlugins(1);
    }

    async enableGroupPlugin(pluginName) {
        if (!this.currentGroupId) return;

        try {
            const response = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}/groups/${encodeURIComponent(this.currentGroupId)}/enable`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('插件已在群组中启用', 'success');
                this.loadGroupPlugins(this.groupPluginsPage);
            } else {
                this.showNotification(result.message || '启用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to enable group plugin:', error);
            this.showNotification('启用插件失败: ' + error.message, 'error');
        }
    }

    async disableGroupPlugin(pluginName) {
        if (!this.currentGroupId) return;

        if (!confirm('确定要在该群组中禁用这个插件吗？')) return;

        try {
            const response = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}/groups/${encodeURIComponent(this.currentGroupId)}/disable`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('插件已在群组中禁用', 'success');
                this.loadGroupPlugins(this.groupPluginsPage);
            } else {
                this.showNotification(result.message || '禁用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to disable group plugin:', error);
            this.showNotification('禁用插件失败: ' + error.message, 'error');
        }
    }

    async enableGroup(groupId) {
        try {
            const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/enable`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('群组已启用', 'success');
                this.loadGroups(this.currentPage);
            } else {
                this.showNotification(result.message || '启用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to enable group:', error);
            this.showNotification('启用操作失败: ' + error.message, 'error');
        }
    }

    async disableGroup(groupId) {
        if (!confirm('确定要禁用这个群组吗？机器人将不再响应该群组的消息。')) return;

        try {
            const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/disable`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('群组已禁用', 'success');
                this.loadGroups(this.currentPage);
            } else {
                this.showNotification(result.message || '禁用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to disable group:', error);
            this.showNotification('禁用操作失败: ' + error.message, 'error');
        }
    }

    async banUser(groupId, userId) {
        const reason = prompt('请输入封禁原因:');
        if (reason === null) return;

        try {
            const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(userId)}/ban?reason=${encodeURIComponent(reason)}`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户已封禁', 'success');
                this.viewGroupDetail(groupId);
            } else {
                this.showNotification(result.message || '封禁失败', 'error');
            }
        } catch (error) {
            console.error('Failed to ban user:', error);
            this.showNotification('封禁操作失败: ' + error.message, 'error');
        }
    }

    async unbanUser(groupId, userId) {
        try {
            const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(userId)}/unban`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('用户已解封', 'success');
                this.viewGroupDetail(groupId);
            } else {
                this.showNotification(result.message || '解封失败', 'error');
            }
        } catch (error) {
            console.error('Failed to unban user:', error);
            this.showNotification('解封操作失败: ' + error.message, 'error');
        }
    }

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

const groupsManager = new GroupsManager();