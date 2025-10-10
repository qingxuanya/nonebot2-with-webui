class PluginsManager {
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

        this.loadPlugins();
        this.loadPluginStats();
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
        document.getElementById('refreshPluginsBtn')?.addEventListener('click', () => {
            this.loadPlugins();
            this.loadPluginStats();
        });

        // 群组设置保存
        document.getElementById('saveGroupSettingsBtn')?.addEventListener('click', () => this.saveGroupSettings());
    }

    async loadPlugins(page = 1) {
        this.currentPage = page;

        const params = new URLSearchParams({
            page: page,
            page_size: this.pageSize,
            ...this.searchParams
        });

        try {
            const response = await fetch(`/api/plugins?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.renderPluginsTable(data.plugins || []);
            this.renderPagination(data.total || 0, data.page || 1, data.page_size || this.pageSize);
        } catch (error) {
            console.error('Failed to load plugins:', error);
            this.showNotification('加载插件列表失败', 'error');
        }
    }

    async loadPluginStats() {
        try {
            const response = await fetch('/api/plugins/stats', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const stats = await response.json();
            this.renderPluginStats(stats);
        } catch (error) {
            console.error('Failed to load plugin stats:', error);
        }
    }

    renderPluginStats(stats) {
        if (!stats) return;

        document.getElementById('totalPlugins').textContent = stats.total_plugins || 0;
        document.getElementById('enabledPlugins').textContent = stats.enabled_plugins || 0;
        document.getElementById('disabledPlugins').textContent = stats.disabled_plugins || 0;
        document.getElementById('groupSettings').textContent = stats.group_settings || 0;
    }

    renderPluginsTable(plugins) {
        const tbody = document.querySelector('#pluginsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (plugins && plugins.length > 0) {
            plugins.forEach(plugin => {
                const row = document.createElement('tr');

                // 安全处理插件数据
                const pluginName = plugin.plugin_name || '未知';
                const displayName = plugin.display_name || pluginName;
                const version = plugin.version || '1.0.0';
                const author = plugin.author || '未知';
                const description = plugin.description || '暂无描述';
                const isEnabled = plugin.is_global_enabled !== false;
                const isSafe = plugin.is_safe !== false;

                row.innerHTML = `
                    <td>
                        <strong>${this.escapeHtml(pluginName)}</strong>
                        ${!isSafe ? '<span class="badge bg-warning ms-1">不安全</span>' : ''}
                    </td>
                    <td>${this.escapeHtml(displayName)}</td>
                    <td><span class="badge bg-secondary">${this.escapeHtml(version)}</span></td>
                    <td>${this.escapeHtml(author)}</td>
                    <td class="text-truncate" style="max-width: 200px;" title="${this.escapeHtml(description)}">
                        ${this.escapeHtml(description)}
                    </td>
                    <td>
                        ${isEnabled ? 
                            '<span class="badge bg-success">已启用</span>' : 
                            '<span class="badge bg-danger">已禁用</span>'
                        }
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="pluginsManager.viewPluginDetail('${this.escapeHtml(pluginName)}')" title="查看详情">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${isEnabled ?
                                `<button class="btn btn-outline-warning" onclick="pluginsManager.disablePlugin('${this.escapeHtml(pluginName)}')" title="禁用插件">
                                    <i class="bi bi-pause"></i>
                                </button>` :
                                `<button class="btn btn-outline-success" onclick="pluginsManager.enablePlugin('${this.escapeHtml(pluginName)}')" title="启用插件">
                                    <i class="bi bi-play"></i>
                                </button>`
                            }
                            <button class="btn btn-outline-info" onclick="pluginsManager.showGroupSettings('${this.escapeHtml(pluginName)}')" title="群组设置">
                                <i class="bi bi-gear"></i>
                            </button>
                        </div>
                    </td>
                `;

                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无插件数据</td></tr>';
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
            if (page > 1) this.loadPlugins(page - 1);
        });
        pagination.appendChild(prevLi);

        // 页码
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === page ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadPlugins(i);
            });
            pagination.appendChild(li);
        }

        // 下一页
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${page === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#">下一页</a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (page < totalPages) this.loadPlugins(page + 1);
        });
        pagination.appendChild(nextLi);
    }

    handleSearch() {
        this.searchParams = {
            search: document.getElementById('searchInput')?.value || '',
            enabled: document.getElementById('enabledFilter')?.value || undefined
        };

        this.loadPlugins(1);
    }

    async viewPluginDetail(pluginName) {
        try {
            // 这里可以加载插件的详细信息
            const pluginDetail = {
                name: pluginName,
                // 实际应该从API获取详细信息
            };

            this.renderPluginDetailModal(pluginDetail);
        } catch (error) {
            console.error('Failed to load plugin detail:', error);
            this.showNotification('加载插件详情失败', 'error');
        }
    }

    renderPluginDetailModal(pluginDetail) {
        const title = document.getElementById('pluginDetailTitle');
        const content = document.getElementById('pluginDetailContent');

        if (!title || !content) return;

        title.textContent = `插件详情 - ${this.escapeHtml(pluginDetail.name)}`;

        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>基本信息</h6>
                    <table class="table table-sm">
                        <tr><td>插件名称:</td><td>${this.escapeHtml(pluginDetail.name)}</td></tr>
                        <tr><td>模块路径:</td><td>${this.escapeHtml(pluginDetail.plugin_module || '--')}</td></tr>
                        <tr><td>版本:</td><td>${this.escapeHtml(pluginDetail.version || '1.0.0')}</td></tr>
                        <tr><td>作者:</td><td>${this.escapeHtml(pluginDetail.author || '未知')}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>状态信息</h6>
                    <table class="table table-sm">
                        <tr><td>全局状态:</td><td>${pluginDetail.is_global_enabled ? '已启用' : '已禁用'}</td></tr>
                        <tr><td>安全性:</td><td>${pluginDetail.is_safe ? '安全' : '不安全'}</td></tr>
                        <tr><td>优先级:</td><td>${pluginDetail.priority || 10}</td></tr>
                    </table>
                </div>
            </div>
            ${pluginDetail.description ? `
            <div class="row mt-3">
                <div class="col-12">
                    <h6>插件描述</h6>
                    <p>${this.escapeHtml(pluginDetail.description)}</p>
                </div>
            </div>
            ` : ''}
        `;

        new bootstrap.Modal(document.getElementById('pluginDetailModal')).show();
    }

    showGroupSettings(pluginName) {
        const pluginNameInput = document.getElementById('settingsPluginName');
        const groupIdInput = document.getElementById('settingsGroupId');
        const enabledInput = document.getElementById('settingsPluginEnabled');

        if (pluginNameInput) pluginNameInput.value = pluginName;
        if (groupIdInput) groupIdInput.value = '';
        if (enabledInput) enabledInput.checked = true;

        new bootstrap.Modal(document.getElementById('groupPluginSettingsModal')).show();
    }

    async saveGroupSettings() {
        const pluginName = document.getElementById('settingsPluginName')?.value;
        const groupId = document.getElementById('settingsGroupId')?.value;
        const enabled = document.getElementById('settingsPluginEnabled')?.checked;

        if (!pluginName || !groupId) {
            this.showNotification('请输入完整的设置信息', 'error');
            return;
        }

        try {
            const endpoint = enabled ? 'enable' : 'disable';
            const response = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}/groups/${encodeURIComponent(groupId)}/${endpoint}`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('群组插件设置已保存', 'success');
                bootstrap.Modal.getInstance(document.getElementById('groupPluginSettingsModal')).hide();
            } else {
                this.showNotification(result.message || '保存失败', 'error');
            }
        } catch (error) {
            console.error('Failed to save group settings:', error);
            this.showNotification('保存设置失败', 'error');
        }
    }

    async enablePlugin(pluginName) {
        try {
            const response = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}/enable`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('插件已启用', 'success');
                this.loadPlugins(this.currentPage);
                this.loadPluginStats();
            } else {
                this.showNotification(result.message || '启用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to enable plugin:', error);
            this.showNotification('启用操作失败', 'error');
        }
    }

    async disablePlugin(pluginName) {
        if (!confirm('确定要禁用这个插件吗？')) return;

        try {
            const response = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}/disable`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('插件已禁用', 'success');
                this.loadPlugins(this.currentPage);
                this.loadPluginStats();
            } else {
                this.showNotification(result.message || '禁用失败', 'error');
            }
        } catch (error) {
            console.error('Failed to disable plugin:', error);
            this.showNotification('禁用操作失败', 'error');
        }
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
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 5000);
        }
    }
}

// 全局实例
const pluginsManager = new PluginsManager();