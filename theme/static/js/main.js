// 全局WebUI管理器
class WebUIManager {
    constructor() {
        this.apiBase = '/api';
        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
        this.setupAutoRefresh();
        // 不在这里检查认证状态，让各个页面自己处理
    }

    setupGlobalEventListeners() {
        // 全局错误处理
        window.addEventListener('error', (e) => {
            console.error('Global error:', e);
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e);
        });

        // 全局API拦截器
        this.setupApiInterceptor();
    }

    setupApiInterceptor() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);

                // 检查认证状态
                if (response.status === 401) {
                    this.handleUnauthorized();
                    throw new Error('未授权访问');
                }

                return response;
            } catch (error) {
                if (error.message === 'Failed to fetch') {
                    this.showNotification('网络连接失败，请检查服务器状态', 'error');
                }
                throw error;
            }
        };
    }

    handleUnauthorized() {
        // 清除登录状态
        document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        // 只有在需要登录的页面才跳转
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
    }

    async checkAuthStatus() {
        // 如果不是登录页面，检查认证状态
        if (!window.location.pathname.includes('/login')) {
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
        return true;
    }

    setupAutoRefresh() {
        // 仪表板页面自动刷新
        if (window.location.pathname === '/') {
            setInterval(() => {
                if (window.dashboardManager) {
                    window.dashboardManager.loadDashboardData();
                }
            }, 30000); // 每30秒刷新
        }
    }

    // 全局工具方法
    formatDateTime(dateString) {
        if (!dateString) return '--';
        return new Date(dateString).toLocaleString('zh-CN');
    }

    formatRelativeTime(dateString) {
        if (!dateString) return '--';

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;

        return this.formatDateTime(dateString);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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

    // 全局加载状态管理
    showLoading(container) {
        const spinner = document.createElement('div');
        spinner.className = 'd-flex justify-content-center';
        spinner.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
        `;
        container.innerHTML = '';
        container.appendChild(spinner);
    }

    hideLoading(container) {
        const spinner = container.querySelector('.spinner-border');
        if (spinner) {
            spinner.remove();
        }
    }
}

// 初始化全局管理器
const webUIManager = new WebUIManager();

// 使管理器在全局可用
window.webUIManager = webUIManager;
window.showNotification = webUIManager.showNotification.bind(webUIManager);

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 设置活跃导航链接
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '/' && href === '/')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 初始化工具提示
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // 如果不是登录页面，检查认证状态
    if (!window.location.pathname.includes('/login')) {
        webUIManager.checkAuthStatus().then(isAuthenticated => {
            if (!isAuthenticated) {
                // 已经跳转到登录页面，这里不需要做任何事
                return;
            }

            // 如果是认证页面且已登录，加载用户信息
            loadUserInfo();
        });
    }
});

// 加载用户信息
async function loadUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const userInfo = await response.json();
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                usernameElement.textContent = userInfo.username;
            }
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}