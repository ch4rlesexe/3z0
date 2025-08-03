// Authentication state management
class AuthManager {
    constructor() {
        console.log('AuthManager: Initializing...');
        this.authToken = localStorage.getItem('authToken');
        this.currentUser = null;
        
        // Set cookie if token exists in localStorage
        if (this.authToken) {
            document.cookie = `authToken=${this.authToken}; path=/; max-age=${24 * 60 * 60}; SameSite=Strict`;
        }
        
        // Call updateNavbar immediately to prevent flash
        this.updateNavbar();
        
        this.init();
    }

    async init() {
        if (this.authToken) {
            await this.loadCurrentUser();
        }
        this.updateNavbar();
        this.setupEventListeners();
    }

    async loadCurrentUser() {
        if (!this.authToken) {
            this.updateNavbar();
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.updateNavbar();
            } else {
                // Token is invalid, clear it
                this.authToken = null;
                this.currentUser = null;
                localStorage.removeItem('authToken');
                this.updateNavbar();
            }
        } catch (error) {
            console.error('Error loading current user:', error);
            this.authToken = null;
            this.currentUser = null;
            localStorage.removeItem('authToken');
            this.updateNavbar();
        }
    }

    updateNavbar() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.querySelector('.user-menu');
        const navActions = document.querySelector('.nav-actions');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const adminLink = document.querySelector('.admin-only');
        const profileLink = document.getElementById('profileLink');
        const loadingScreen = document.getElementById('loadingScreen');

        // Remove loading state
        if (navActions) {
            navActions.classList.remove('auth-loading');
            navActions.classList.add('auth-loaded');
        }

        if (this.currentUser) {
            // User is logged in - show user menu, hide auth buttons
            if (authButtons) {
                authButtons.classList.remove('show');
                authButtons.style.display = 'none';
            }
            if (userMenu) {
                userMenu.style.display = 'block';
            }

            // Update user info
            if (userName) userName.textContent = this.currentUser.display_name || this.currentUser.username;
            if (userAvatar) {
                if (this.currentUser.profile_picture) {
                    userAvatar.innerHTML = `<img src="${this.currentUser.profile_picture}" alt="Avatar" />`;
                } else {
                    userAvatar.innerHTML = '<i class="fas fa-user"></i>';
                }
            }

            // Set profile link URL
            if (profileLink && this.currentUser.username) {
                profileLink.href = `/user/${this.currentUser.username}`;
            }

            // Check admin permissions and show admin link
            if (adminLink) {
                this.checkAdminPermissions().then(isAdmin => {
                    if (isAdmin) {
                        adminLink.style.display = 'block';
                    } else {
                        adminLink.style.display = 'none';
                    }
                });
            }
        } else {
            // User is not logged in - show auth buttons, hide user menu
            if (authButtons) {
                authButtons.classList.add('show');
                authButtons.style.display = 'flex';
            }
            if (userMenu) {
                userMenu.style.display = 'none';
            }
        }

        // Hide loading screen with smooth transition
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 300);
        }
    }

    async checkAdminPermissions() {
        try {
            const response = await fetch('/api/admin/check-admin', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.isAdmin;
            }
            return false;
        } catch (error) {
            console.error('Error checking admin permissions:', error);
            return false;
        }
    }

    setupEventListeners() {
        // User menu toggle
        const userMenuToggle = document.getElementById('userMenuToggle');
        const userDropdown = document.getElementById('userDropdown');

        if (userMenuToggle && userDropdown) {
            userMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!userMenuToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.remove('show');
                }
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // Public profile link
        const publicProfileLink = document.getElementById('publicProfileLink');
        if (publicProfileLink && this.currentUser) {
            publicProfileLink.href = `/user/${this.currentUser.username}`;
        }
    }

    login(email, password) {
        return fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.token) {
                this.authToken = data.token;
                localStorage.setItem('authToken', data.token);
                // Also set cookie for server-side auth
                document.cookie = `authToken=${data.token}; path=/; max-age=${24 * 60 * 60}; SameSite=Strict`;
                this.loadCurrentUser();
                return { success: true };
            } else {
                return { success: false, message: data.message || 'Login failed' };
            }
        });
    }

    register(userData) {
        return fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.token) {
                this.authToken = data.token;
                localStorage.setItem('authToken', data.token);
                // Also set cookie for server-side auth
                document.cookie = `authToken=${data.token}; path=/; max-age=${24 * 60 * 60}; SameSite=Strict`;
                this.loadCurrentUser();
                return { success: true };
            } else {
                return { success: false, message: data.message || 'Registration failed' };
            }
        });
    }

    logout() {
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        // Remove cookie
        document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        this.updateNavbar();
        
        // End session tracking
        this.endSessionTracking();
        
        // Redirect to home page
        window.location.href = '/';
    }

    startSessionTracking() {
        if (!this.currentUser) return;
        
        // Generate session ID
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Track session start
        fetch('/api/analytics/session/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: this.currentUser.id,
                session_id: this.sessionId
            })
        }).catch(error => console.error('Session start tracking error:', error));
        
        // Track session end when page is unloaded
        window.addEventListener('beforeunload', () => {
            this.endSessionTracking();
        });
    }

    endSessionTracking() {
        if (!this.sessionId) return;
        
        // Track session end
        fetch('/api/analytics/session/end', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: this.sessionId
            })
        }).catch(error => console.error('Session end tracking error:', error));
        
        this.sessionId = null;
    }

    isAuthenticated() {
        return !!this.authToken && !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getAuthToken() {
        return this.authToken;
    }
}

// Initialize AuthManager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('AuthManager: DOM loaded, creating instance...');
    window.authManager = new AuthManager();
    console.log('AuthManager: Instance created and assigned to window.authManager');
}); 