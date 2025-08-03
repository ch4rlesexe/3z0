// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.currentPage = 'dashboard';
        this.authToken = null;
        this.currentEditingUser = null;
        this.quill = null;
        this.currentPostId = null;
        this.authTimeout = null;
        this.waitCount = 0;
        
        this.waitForAuthManager();
        
        // Fallback: redirect to login if authManager doesn't load within 10 seconds
        this.authTimeout = setTimeout(() => {
            console.log('Admin: AuthManager timeout after 10 seconds, redirecting to login');
            console.log('Admin: window.authManager exists:', !!window.authManager);
            sessionStorage.setItem('redirectAfterLogin', '/admin');
            window.location.href = '/login';
        }, 10000);
    }
    
    waitForAuthManager() {
        this.waitCount++;
        console.log(`Admin: Waiting for authManager... (attempt ${this.waitCount})`);
        console.log('Admin: window.authManager exists:', !!window.authManager);
        
        if (window.authManager) {
            console.log('Admin: authManager found!');
            // Clear the timeout since authManager was found
            if (this.authTimeout) {
                clearTimeout(this.authTimeout);
                this.authTimeout = null;
            }
            this.authToken = window.authManager.getAuthToken();
            console.log('Admin: Auth token:', this.authToken ? 'Present' : 'Missing');
            this.init();
        } else {
            console.log('Admin: authManager not found, waiting...');
            // Wait for authManager to be initialized, but don't wait forever
            if (this.waitCount < 100) { // Max 10 seconds (100 * 100ms)
                setTimeout(() => this.waitForAuthManager(), 100);
            } else {
                console.log('Admin: Max wait attempts reached, redirecting to login');
                sessionStorage.setItem('redirectAfterLogin', '/admin');
                window.location.href = '/login';
            }
        }
    }
    
    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.setupQuillEditor();
        // Don't load dashboard here - wait for authentication
    }
    
    checkAuth() {
        console.log('Admin page: checkAuth called');
        console.log('Auth token present:', !!this.authToken);
        
        if (!this.authToken) {
            console.log('No auth token, redirecting to login');
            // Store the intended destination for after login
            sessionStorage.setItem('redirectAfterLogin', '/admin');
            window.location.href = '/login';
            return;
        }
        
        console.log('Verifying token and checking admin role...');
        // Verify token and check admin role
        fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            }
        })
        .then(response => {
            console.log('Auth me response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Auth me response data:', data);
            if (data.user) {
                this.currentUser = data.user;
                console.log('Current user loaded:', this.currentUser);
                // Check if user has admin role
                this.checkAdminRole();
            } else {
                console.log('No user data, redirecting to main site');
                this.redirectToMainSite();
            }
        })
        .catch((error) => {
            console.error('Auth me error:', error);
            this.redirectToMainSite();
        });
    }
    
    async checkAdminRole() {
        try {
            console.log('Checking admin role for user:', this.currentUser);
            console.log('Auth token:', this.authToken ? 'Present' : 'Missing');
            
            const response = await fetch('/api/admin/check-admin', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            console.log('Admin check response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Admin check response data:', data);
                if (data.isAdmin) {
                    console.log('User is admin, proceeding...');
                    this.updateUserInfo();
                    // Only load dashboard after authentication is confirmed
                    this.loadDashboard();
                } else {
                    console.log('User is not admin, redirecting...');
                    this.redirectToMainSite();
                }
            } else {
                console.log('Admin check failed, redirecting...');
                this.redirectToMainSite();
            }
        } catch (error) {
            console.error('Error checking admin role:', error);
            this.redirectToMainSite();
        }
    }
    
    redirectToMainSite() {
        // Clear any stored redirect
        sessionStorage.removeItem('redirectAfterLogin');
        // Redirect to main site instead of logging out
        window.location.href = '/';
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                if (page) {
                    this.showPage(page);
                }
            });
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // New post button
        document.getElementById('new-post-btn').addEventListener('click', () => {
            this.openPostModal();
        });

        // Post form
        document.getElementById('postForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePost();
        });

        // Image preview
        document.getElementById('postImage').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });

        // Excerpt character count
        document.getElementById('postExcerpt').addEventListener('input', (e) => {
            const count = e.target.value.length;
            document.getElementById('excerptCount').textContent = count;
        });

        // Role form
        document.getElementById('roleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRole();
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });

        // Event delegation for dynamic buttons
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.dataset.action;
            
            switch(action) {
                case 'edit-post':
                    this.editPost(parseInt(target.dataset.postId));
                    break;
                case 'delete-post':
                    this.deletePost(parseInt(target.dataset.postId));
                    break;
                case 'edit-user':
                    this.editUser(parseInt(target.dataset.userId));
                    break;
                case 'toggle-comment-approval':
                    this.toggleCommentApproval(parseInt(target.dataset.commentId), target.dataset.approve === 'true');
                    break;
                case 'delete-comment':
                    this.deleteComment(parseInt(target.dataset.commentId));
                    break;
                case 'close-modal':
                    this.closeModals();
                    break;
                case 'verify-user':
                    this.verifyUser();
                    break;
                case 'toggle-ban':
                    this.toggleUserBan();
                    break;
                case 'delete-user':
                    this.deleteUser();
                    break;
                case 'add-role':
                    this.addRoleToUser();
                    break;
                case 'new-role':
                    this.openRoleModal();
                    break;
                case 'edit-role':
                    this.openRoleModal(parseInt(target.dataset.roleId));
                    break;
                case 'delete-role':
                    this.deleteRole(parseInt(target.dataset.roleId));
                    break;
            }
        });

        // User edit form
        const userEditForm = document.getElementById('userEditForm');
        if (userEditForm) {
            userEditForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveUserChanges();
            });
        }

        // User action buttons
        const verifyUserBtn = document.getElementById('verifyUserBtn');
        if (verifyUserBtn) {
            verifyUserBtn.addEventListener('click', () => {
                if (this.currentEditingUser) {
                    this.verifyUser(this.currentEditingUser.id);
                }
            });
        }

        const toggleBanBtn = document.getElementById('toggleBanBtn');
        if (toggleBanBtn) {
            toggleBanBtn.addEventListener('click', () => {
                if (this.currentEditingUser) {
                    this.toggleUserBan(this.currentEditingUser.id);
                }
            });
        }

        const deactivateUserBtn = document.getElementById('deactivateUserBtn');
        if (deactivateUserBtn) {
            deactivateUserBtn.addEventListener('click', () => {
                if (this.currentEditingUser) {
                    this.deactivateUser();
                }
            });
        }

        const reactivateUserBtn = document.getElementById('reactivateUserBtn');
        if (reactivateUserBtn) {
            reactivateUserBtn.addEventListener('click', () => {
                if (this.currentEditingUser) {
                    this.reactivateUser();
                }
            });
        }
    }
    
    setupQuillEditor() {
        this.quill = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image', 'blockquote', 'code-block'],
                    ['clean']
                ]
            },
            placeholder: 'Write your post content here...'
        });
    }
    
    showPage(page) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        // Show page
        document.querySelectorAll('.admin-page').forEach(p => {
            p.classList.remove('active');
        });
        document.getElementById(`${page}-page`).classList.add('active');
        
        // Load page data
        switch(page) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'posts':
                this.loadPosts();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'roles':
                this.loadRoles();
                break;
            case 'comments':
                this.loadComments();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }
    
    updateUserInfo() {
        // Update user info in UI if needed
        console.log('Current user:', this.currentUser);
    }
    
    logout() {
        localStorage.removeItem('authToken');
        this.authToken = null;
        this.currentUser = null;
        window.location.href = '/login.html';
    }
    
    // Dashboard
    async loadDashboard() {
        try {
            // Make all API calls in parallel for faster loading
            const [dashboardResponse, postsResponse, usersResponse, commentsResponse] = await Promise.all([
                fetch('/api/admin/dashboard', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                }),
                fetch('/api/admin/posts?limit=5', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                }),
                fetch('/api/admin/users?limit=5', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                }),
                fetch('/api/admin/comments?limit=5', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                })
            ]);

            // Process all responses
            const [dashboardData, postsData, usersData, commentsData] = await Promise.all([
                dashboardResponse.json(),
                postsResponse.json(),
                usersResponse.json(),
                commentsResponse.json()
            ]);

            if (dashboardResponse.ok) {
                this.updateDashboardStats(dashboardData.stats);
                this.updateRecentActivity(dashboardData.recentActivity || []);
            }

            if (postsResponse.ok) {
                this.updateRecentPosts(postsData.posts || []);
            }

            if (usersResponse.ok) {
                this.updateRecentUsers(usersData.users || []);
            }

            if (commentsResponse.ok) {
                this.updateRecentComments(commentsData.comments || []);
            }

        } catch (error) {
            console.error('Dashboard load error:', error);
        }
    }
    
    updateDashboardStats(stats) {
        document.getElementById('total-posts').textContent = stats.posts?.total_posts || 0;
        document.getElementById('total-users').textContent = stats.users?.total_users || 0;
        document.getElementById('total-comments').textContent = stats.engagement?.total_comments || 0;
        document.getElementById('total-views').textContent = stats.posts?.total_views || 0;
    }
    
    updateRecentActivity(posts) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        container.innerHTML = posts.map(post => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${post.title}</div>
                    <div class="activity-meta">
                        ${new Date(post.created_at).toLocaleDateString()} • ${post.status}
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateRecentPosts(posts) {
        const container = document.getElementById('recentPosts');
        if (!container) return;
        
        container.innerHTML = posts.map(post => `
            <div class="recent-item">
                <div class="recent-item-title">${post.title}</div>
                <div class="recent-item-meta">
                    ${new Date(post.created_at).toLocaleDateString()} • ${post.status}
                </div>
            </div>
        `).join('');
    }

    updateRecentUsers(users) {
        const container = document.getElementById('recentUsers');
        if (!container) return;
        
        container.innerHTML = users.map(user => `
            <div class="recent-item">
                <div class="recent-item-title">${user.display_name || user.username}</div>
                <div class="recent-item-meta">
                    ${new Date(user.created_at).toLocaleDateString()} • ${user.is_verified ? 'Verified' : 'Pending'}
                </div>
            </div>
        `).join('');
    }

    updateRecentComments(comments) {
        const container = document.getElementById('recentComments');
        if (!container) return;
        
        container.innerHTML = comments.map(comment => `
            <div class="recent-item">
                <div class="recent-item-title">${comment.content.substring(0, 50)}...</div>
                <div class="recent-item-meta">
                    ${comment.username} • ${new Date(comment.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    }
    
    // Posts
    async loadPosts() {
        try {
            const response = await fetch('/api/admin/posts', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.renderPosts(data.posts);
            }
        } catch (error) {
            console.error('Posts load error:', error);
        }
    }
    
    renderPosts(posts) {
        const container = document.getElementById('posts-grid');
        container.innerHTML = posts.map(post => `
            <div class="post-card">
                <div class="post-image" style="background-image: url('${post.image_url || '/assets/nobg.png'}')"></div>
                <div class="post-content">
                    <h3>${post.title}</h3>
                    <div class="post-meta">
                        <span><i class="fas fa-user"></i> ${post.author_username}</span>
                        <span><i class="fas fa-calendar"></i> ${new Date(post.created_at).toLocaleDateString()}</span>
                        <span class="status-badge status-${post.status}">${post.status}</span>
                    </div>
                    <div class="post-actions">
                        <button class="btn btn-primary btn-sm" data-action="edit-post" data-post-id="${post.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" data-action="delete-post" data-post-id="${post.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    openPostModal(postId = null) {
        const modal = document.getElementById('postModal');
        if (modal) {
            modal.style.display = 'block';
            if (postId) {
                this.loadPostData(postId);
            } else {
                this.resetPostForm();
            }
        }
    }
    
    async loadPostData(postId) {
        try {
            const response = await fetch(`/api/posts/id/${postId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            const post = await response.json();
            
            if (response.ok) {
                document.getElementById('postTitle').value = post.title || '';
                document.getElementById('postCategory').value = post.category || '';
                document.getElementById('postStatus').value = post.status || 'draft';
                document.getElementById('postExcerpt').value = post.excerpt || '';
                document.getElementById('postTags').value = post.tags || '';
                
                // Update excerpt character count
                const excerptCount = document.getElementById('excerptCount');
                if (excerptCount) {
                    excerptCount.textContent = (post.excerpt || '').length;
                }
                
                // Set Quill content
                if (this.quill) {
                    this.quill.root.innerHTML = post.content || '';
                }
                
                // Show image preview if exists
                const imagePreview = document.getElementById('imagePreview');
                if (imagePreview) {
                    if (post.image_url) {
                        imagePreview.innerHTML = `<img src="${post.image_url}" alt="Featured image" style="max-width: 200px; max-height: 200px;">`;
                    } else {
                        imagePreview.innerHTML = '<p>No image selected</p>';
                    }
                }
            } else {
                console.error('Post load error:', post.message);
            }
        } catch (error) {
            console.error('Post load error:', error);
        }
    }
    
    async savePost() {
        const form = document.getElementById('postForm');
        const formData = new FormData(form);
        
        // Get content from Quill editor
        if (this.quill) {
            const content = this.quill.root.innerHTML;
            formData.append('content', content);
        }
        
        // Get tags as array
        const tagsInput = document.getElementById('postTags');
        if (tagsInput) {
            const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            formData.append('tags', JSON.stringify(tags));
        }
        
        // Add image if selected
        const imageFile = document.getElementById('postImage').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        try {
            const url = this.currentPostId ? `/api/posts/${this.currentPostId}` : '/api/posts';
            const method = this.currentPostId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.closeModals();
                this.loadPosts();
                alert(this.currentPostId ? 'Post updated successfully!' : 'Post created successfully!');
            } else {
                alert(data.message || 'Error saving post');
            }
        } catch (error) {
            console.error('Post save error:', error);
            alert('Error saving post');
        }
    }
    
    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) return;
        
        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                this.loadPosts();
                alert('Post deleted successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error deleting post');
            }
        } catch (error) {
            console.error('Post delete error:', error);
            alert('Error deleting post');
        }
    }
    
    editPost(postId) {
        this.openPostModal(postId);
    }
    
    // Users
    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderUsers(data.users);
                
                // Load roles for all users in parallel
                const rolePromises = data.users.map(user => 
                    fetch(`/api/admin/users/${user.id}/roles`, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    }).then(res => res.json()).catch(() => ({ roles: [] }))
                );
                
                const roleResults = await Promise.all(rolePromises);
                
                // Update user rows with role information
                roleResults.forEach((result, index) => {
                    const user = data.users[index];
                    if (result.roles) {
                        this.updateUserRoles(user.id, result.roles);
                    }
                });
            }
        } catch (error) {
            console.error('Users load error:', error);
        }
    }
    
    renderUsers(users) {
        const container = document.getElementById('usersTable');
        if (!container) return;
        
        container.innerHTML = `
            <thead>
                <tr>
                    <th>Avatar</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Display Name</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr data-user-id="${user.id}">
                        <td>
                            <div class="user-avatar">
                                ${user.profile_picture ? 
                                    `<img src="${user.profile_picture}" alt="Avatar" />` : 
                                    `<i class="fas fa-user"></i>`
                                }
                            </div>
                        </td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.display_name || '-'}</td>
                        <td class="user-roles">
                            <div class="role-badges">
                                ${user.roles ? user.roles.map(role => 
                                    `<span class="role-badge">${role.name}</span>`
                                ).join('') : '-'}
                            </div>
                        </td>
                        <td>
                            <span class="status-badge ${user.is_banned ? 'banned' : user.is_deactivated ? 'deactivated' : 'active'}">
                                ${user.is_banned ? 'Banned' : user.is_deactivated ? 'Deactivated' : 'Active'}
                            </span>
                        </td>
                        <td>${new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                            <div class="user-actions">
                                <button class="btn btn-sm btn-primary" onclick="adminPanel.editUser(${user.id})">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-info" onclick="adminPanel.manageUserRoles(${user.id})">
                                    <i class="fas fa-user-tag"></i> Roles
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
    }
    
    async editUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                const user = await response.json();
                this.currentEditingUser = user;
                this.renderUserDetails(user);
                this.loadUserSessionTime(userId);
                this.openUserModal();
            } else {
                console.error('Failed to load user details');
            }
        } catch (error) {
            console.error('Error loading user details:', error);
        }
    }

    async loadUserSessionTime(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/session-time`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                const sessionData = await response.json();
                this.renderSessionTime(sessionData);
            } else {
                console.error('Failed to load session time');
            }
        } catch (error) {
            console.error('Error loading session time:', error);
        }
    }

    renderSessionTime(sessionData) {
        document.getElementById('totalSessionTime').textContent = sessionData.formatted_time;
        document.getElementById('sessionCount').textContent = sessionData.session_count;
        
        const avgMinutes = Math.floor(sessionData.avg_session_seconds / 60);
        const avgSeconds = sessionData.avg_session_seconds % 60;
        document.getElementById('avgSessionTime').textContent = `${avgMinutes}m ${avgSeconds}s`;
    }

    renderUserDetails(user) {
        // Update user info display
        document.getElementById('modalUserName').textContent = user.display_name || user.username;
        document.getElementById('modalUserEmail').textContent = user.email;
        
        // Update avatar
        const avatar = document.getElementById('modalUserAvatar');
        if (user.profile_picture) {
            avatar.innerHTML = `<img src="${user.profile_picture}" alt="Avatar" />`;
        } else {
            avatar.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        // Update status badge
        const statusBadge = document.getElementById('modalUserStatus');
        if (user.is_deactivated) {
            statusBadge.textContent = 'Deactivated';
            statusBadge.className = 'status-badge deactivated';
        } else if (user.is_banned) {
            statusBadge.textContent = 'Banned';
            statusBadge.className = 'status-badge banned';
        } else {
            statusBadge.textContent = 'Active';
            statusBadge.className = 'status-badge active';
        }
        
        // Populate form fields
        document.getElementById('editUsername').value = user.username || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editFirstName').value = user.first_name || '';
        document.getElementById('editLastName').value = user.last_name || '';
        document.getElementById('editDisplayName').value = user.display_name || '';
        document.getElementById('editBio').value = user.bio || '';
        document.getElementById('editWebsite').value = user.website || '';
        document.getElementById('editLocation').value = user.location || '';
        document.getElementById('editBanReason').value = user.ban_reason || '';
        document.getElementById('editDeactivationReason').value = user.deactivation_reason || '';
        
        // Set checkboxes
        document.getElementById('editIsBanned').checked = user.is_banned || false;
        document.getElementById('editIsDeactivated').checked = user.is_deactivated || false;
        
        // Populate social links
        const socialLinks = user.social_links ? JSON.parse(user.social_links) : {};
        document.getElementById('editTwitter').value = socialLinks.twitter || '';
        document.getElementById('editGitHub').value = socialLinks.github || '';
        document.getElementById('editLinkedIn').value = socialLinks.linkedin || '';
        document.getElementById('editInstagram').value = socialLinks.instagram || '';
        
        // Update action buttons visibility
        this.updateActionButtons(user);
    }

    updateActionButtons(user) {
        const verifyBtn = document.getElementById('verifyUserBtn');
        const toggleBanBtn = document.getElementById('toggleBanBtn');
        const deactivateBtn = document.getElementById('deactivateUserBtn');
        const reactivateBtn = document.getElementById('reactivateUserBtn');
        
        // Show/hide verify button based on email verification status
        verifyBtn.style.display = user.email_verified ? 'none' : 'inline-block';
        
        // Update ban button text
        toggleBanBtn.innerHTML = user.is_banned ? 
            '<i class="fas fa-unban"></i> Unban User' : 
            '<i class="fas fa-ban"></i> Ban User';
        
        // Show/hide deactivate/reactivate buttons
        if (user.is_deactivated) {
            deactivateBtn.style.display = 'none';
            reactivateBtn.style.display = 'inline-block';
        } else {
            deactivateBtn.style.display = 'inline-block';
            reactivateBtn.style.display = 'none';
        }
    }

    async saveUserChanges() {
        if (!this.currentEditingUser) return;
        
        const formData = new FormData(document.getElementById('userEditForm'));
        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name'),
            display_name: formData.get('display_name'),
            bio: formData.get('bio'),
            website: formData.get('website'),
            location: formData.get('location'),
            social_links: {
                twitter: formData.get('twitter'),
                github: formData.get('github'),
                linkedin: formData.get('linkedin'),
                instagram: formData.get('instagram')
            },
            is_banned: document.getElementById('editIsBanned').checked,
            ban_reason: formData.get('ban_reason'),
            is_deactivated: document.getElementById('editIsDeactivated').checked,
            deactivation_reason: formData.get('deactivation_reason')
        };
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentEditingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                alert('User information updated successfully!');
                this.closeUserModal();
                this.loadUsers(); // Refresh the users list
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to update user information');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Error updating user information');
        }
    }

    async deactivateUser() {
        if (!this.currentEditingUser) return;
        
        const reason = prompt('Enter deactivation reason:');
        if (!reason) return;
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentEditingUser.id}/deactivate`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ reason })
            });
            
            if (response.ok) {
                alert('User account deactivated successfully!');
                this.closeUserModal();
                this.loadUsers();
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to deactivate user');
            }
        } catch (error) {
            console.error('Error deactivating user:', error);
            alert('Error deactivating user');
        }
    }

    async reactivateUser() {
        if (!this.currentEditingUser) return;
        
        if (!confirm('Are you sure you want to reactivate this user account?')) return;
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentEditingUser.id}/reactivate`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                alert('User account reactivated successfully!');
                this.closeUserModal();
                this.loadUsers();
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to reactivate user');
            }
        } catch (error) {
            console.error('Error reactivating user:', error);
            alert('Error reactivating user');
        }
    }

    async loadUserRoles(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/roles`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.renderUserRoles(data.userRoles, data.allRoles);
            }
        } catch (error) {
            console.error('Load user roles error:', error);
        }
    }

    renderUserRoles(userRoles, allRoles) {
        const container = document.getElementById('userRolesList');
        const select = document.getElementById('addRoleSelect');
        
        // Render current roles
        container.innerHTML = `
            <div class="role-list">
                ${userRoles.map(role => `
                    <div class="role-badge" style="background-color: ${role.color}">
                        <span>${role.name}</span>
                        ${!role.is_system_role ? `<button class="remove-role" onclick="adminPanel.removeRoleFromUser(${role.id})">&times;</button>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        // Populate role select
        select.innerHTML = '<option value="">Select Role to Add</option>';
        allRoles.forEach(role => {
            if (!role.has_role) {
                select.innerHTML += `<option value="${role.id}">${role.name}</option>`;
            }
        });
    }

    async verifyUser() {
        if (!this.currentUserId) return;
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentUserId}/verify`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_verified: true })
            });
            
            if (response.ok) {
                this.loadUsers();
                document.getElementById('userModal').style.display = 'none';
                alert('User verification status updated successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error updating user verification');
            }
        } catch (error) {
            console.error('Verify user error:', error);
            alert('Error updating user verification');
        }
    }

    async toggleUserBan() {
        if (!this.currentUserId) return;
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentUserId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'ban', reason: 'Admin action' })
            });
            
            if (response.ok) {
                this.loadUsers();
                document.getElementById('userModal').style.display = 'none';
                alert('User ban status updated successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error updating user ban status');
            }
        } catch (error) {
            console.error('Toggle user ban error:', error);
            alert('Error updating user ban status');
        }
    }

    async deleteUser() {
        if (!this.currentUserId) return;
        
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentUserId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                this.loadUsers();
                document.getElementById('userModal').style.display = 'none';
                alert('User deleted successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error deleting user');
            }
        } catch (error) {
            console.error('Delete user error:', error);
            alert('Error deleting user');
        }
    }

    async addRoleToUser() {
        if (!this.currentUserId) return;
        
        const roleId = document.getElementById('addRoleSelect').value;
        if (!roleId) {
            alert('Please select a role');
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentUserId}/roles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role_id: parseInt(roleId) })
            });
            
            if (response.ok) {
                this.loadUserRoles(this.currentUserId);
                alert('Role assigned successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error assigning role');
            }
        } catch (error) {
            console.error('Add role error:', error);
            alert('Error assigning role');
        }
    }

    async removeRoleFromUser(roleId) {
        if (!this.currentUserId) return;
        
        if (!confirm('Are you sure you want to remove this role from the user?')) return;
        
        try {
            const response = await fetch(`/api/admin/users/${this.currentUserId}/roles/${roleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                this.loadUserRoles(this.currentUserId);
                alert('Role removed successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error removing role');
            }
        } catch (error) {
            console.error('Remove role error:', error);
            alert('Error removing role');
        }
    }

    async saveRole() {
        const form = document.getElementById('roleForm');
        const formData = new FormData(form);
        
        // Get selected permissions
        const permissions = Array.from(document.querySelectorAll('#permissionsGrid input[type="checkbox"]:checked'))
            .map(checkbox => parseInt(checkbox.value));
        
        const roleData = {
            name: formData.get('name'),
            description: formData.get('description'),
            color: formData.get('color'),
            permissions: permissions
        };
        
        try {
            const url = this.currentRoleId ? `/api/admin/roles/${this.currentRoleId}` : '/api/admin/roles';
            const method = this.currentRoleId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(roleData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.closeModals();
                this.loadRoles();
                alert(this.currentRoleId ? 'Role updated successfully!' : 'Role created successfully!');
            } else {
                alert(data.message || 'Error saving role');
            }
        } catch (error) {
            console.error('Role save error:', error);
            alert('Error saving role');
        }
    }

    async loadRoles() {
        try {
            const response = await fetch('/api/admin/roles', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.renderRoles(data.roles);
            }
        } catch (error) {
            console.error('Roles load error:', error);
        }
    }

    renderRoles(roles) {
        const container = document.getElementById('roles-tbody');
        container.innerHTML = roles.map(role => `
            <tr>
                <td>
                    <div class="role-info">
                        <span class="role-badge" style="background-color: ${role.color}">
                            ${role.name}
                        </span>
                    </div>
                </td>
                <td>${role.description || 'No description'}</td>
                <td>${role.user_count || 0} users</td>
                <td>${role.permission_count || 0} permissions</td>
                <td>
                    <span class="status-badge ${role.is_system_role ? 'status-published' : 'status-pending'}">
                        ${role.is_system_role ? 'System' : 'Custom'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" data-action="edit-role" data-role-id="${role.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!role.is_system_role ? `
                        <button class="btn btn-danger btn-sm" data-action="delete-role" data-role-id="${role.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    openRoleModal(roleId = null) {
        const modal = document.getElementById('roleModal');
        if (modal) {
            modal.style.display = 'block';
            if (roleId) {
                this.loadRoleData(roleId);
            } else {
                this.resetRoleForm();
            }
        }
    }

    async loadRoleData(roleId) {
        try {
            const [roleResponse, permissionsResponse] = await Promise.all([
                fetch(`/api/admin/roles/${roleId}`, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                }),
                fetch('/api/admin/permissions', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                })
            ]);
            
            const role = await roleResponse.json();
            const permissions = await permissionsResponse.json();
            
            if (roleResponse.ok && permissionsResponse.ok) {
                this.renderRoleForm(role, permissions.permissions);
            }
        } catch (error) {
            console.error('Load role error:', error);
        }
    }

    renderRoleForm(role, permissions) {
        document.getElementById('roleModalTitle').textContent = 'Edit Role';
        document.getElementById('roleName').value = role.name;
        document.getElementById('roleDescription').value = role.description || '';
        document.getElementById('roleColor').value = role.color;
        
        // Render permissions
        this.renderPermissions(permissions);
    }

    async loadPermissions() {
        try {
            const response = await fetch('/api/admin/permissions', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderPermissions(data.permissions || []);
            } else {
                console.error('Failed to load permissions');
                this.renderPermissions([]);
            }
        } catch (error) {
            console.error('Load permissions error:', error);
            this.renderPermissions([]);
        }
    }

    renderPermissions(permissions) {
        const container = document.getElementById('permissionsGrid');
        
        if (!permissions || !Array.isArray(permissions)) {
            container.innerHTML = '<p>No permissions available</p>';
            return;
        }
        
        // Group permissions by category
        const grouped = permissions.reduce((acc, permission) => {
            if (!acc[permission.category]) {
                acc[permission.category] = [];
            }
            acc[permission.category].push(permission);
            return acc;
        }, {});
        
        container.innerHTML = `
            <div class="permissions-header">
                <h4>Role Permissions</h4>
                <div class="permissions-controls">
                    <button class="btn btn-primary btn-sm" onclick="adminPanel.selectAllPermissions()">
                        <i class="fas fa-check-double"></i> Select All
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="adminPanel.deselectAllPermissions()">
                        <i class="fas fa-times"></i> Deselect All
                    </button>
                </div>
            </div>
            ${Object.entries(grouped).map(([category, perms]) => `
                <div class="permission-category">
                    <div class="permission-category-header">
                        <i class="fas fa-shield-alt"></i>
                        ${category.replace('_', ' ').toUpperCase()}
                    </div>
                    <div class="permission-list">
                        ${perms.map(permission => `
                            <div class="permission-item">
                                <input type="checkbox" id="perm_${permission.id}" value="${permission.id}" 
                                       ${permission.has_permission ? 'checked' : ''}>
                                <label for="perm_${permission.id}">
                                    ${permission.name.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    <div class="permission-description">${permission.description}</div>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    }
    
    // Comments
    async loadComments() {
        try {
            const response = await fetch('/api/admin/comments', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.renderComments(data.comments);
            }
        } catch (error) {
            console.error('Comments load error:', error);
        }
    }
    
    renderComments(comments) {
        const container = document.getElementById('comments-container');
        container.innerHTML = comments.map(comment => `
            <div class="comment-card">
                <div class="comment-header">
                    <div class="user-avatar">
                        ${comment.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="comment-author">${comment.username}</div>
                        <div class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</div>
                    </div>
                    <span class="status-badge ${comment.is_approved ? 'status-published' : 'status-pending'}">
                        ${comment.is_approved ? 'Approved' : 'Pending'}
                    </span>
                </div>
                <div class="comment-content">
                    ${comment.content}
                </div>
                <div class="comment-actions">
                    <button class="btn ${comment.is_approved ? 'btn-warning' : 'btn-success'} btn-sm" 
                            data-action="toggle-comment-approval" data-comment-id="${comment.id}" data-approve="${!comment.is_approved}">
                        ${comment.is_approved ? 'Reject' : 'Approve'}
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="delete-comment" data-comment-id="${comment.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async toggleCommentApproval(commentId, approve) {
        try {
            const response = await fetch(`/api/admin/comments/${commentId}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_approved: approve })
            });
            
            if (response.ok) {
                this.loadComments();
                alert(`Comment ${approve ? 'approved' : 'rejected'} successfully!`);
            } else {
                const data = await response.json();
                alert(data.message || 'Error updating comment');
            }
        } catch (error) {
            console.error('Comment approval error:', error);
            alert('Error updating comment');
        }
    }
    
    async deleteComment(commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        
        try {
            const response = await fetch(`/api/admin/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                this.loadComments();
                alert('Comment deleted successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error deleting comment');
            }
        } catch (error) {
            console.error('Comment delete error:', error);
            alert('Error deleting comment');
        }
    }
    
    // Analytics
    async loadAnalytics() {
        try {
            const response = await fetch('/api/admin/analytics/dashboard', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.renderAnalytics(data);
            }
        } catch (error) {
            console.error('Analytics load error:', error);
        }
    }
    
    renderAnalytics(data) {
        // Top posts
        const topPostsContainer = document.getElementById('top-posts-list');
        topPostsContainer.innerHTML = data.topPosts.map((post, index) => `
            <div class="activity-item">
                <div class="activity-icon">
                    ${index + 1}
                </div>
                <div class="activity-content">
                    <h4>${post.title}</h4>
                    <p>${post.view_count} views • By ${post.author}</p>
                </div>
            </div>
        `).join('');
        
        // Recent activity
        const recentActivityContainer = document.getElementById('recent-activity-list');
        recentActivityContainer.innerHTML = data.recentActivity.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-${activity.type === 'post' ? 'file-alt' : activity.type === 'comment' ? 'comment' : 'user'}"></i>
                </div>
                <div class="activity-content">
                    <h4>${activity.title}</h4>
                    <p>By ${activity.user} • ${new Date(activity.date).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');
        
        // Charts (placeholder for now)
        this.renderCharts(data);
    }
    
    renderCharts(data) {
        // This would integrate with Chart.js or similar library
        // For now, just placeholder
        console.log('Charts data:', data);
    }
    
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    handleImagePreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('imagePreview');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '<p>No image selected</p>';
        }
    }

    async deleteRole(roleId) {
        if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/roles/${roleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                this.loadRoles();
                alert('Role deleted successfully!');
            } else {
                const data = await response.json();
                alert(data.message || 'Error deleting role');
            }
        } catch (error) {
            console.error('Delete role error:', error);
            alert('Error deleting role');
        }
    }

    openUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) {
            modal.style.display = 'none';
            this.currentEditingUser = null;
        }
    }

    openPostModal(postId = null) {
        const modal = document.getElementById('postModal');
        if (modal) {
            modal.style.display = 'block';
            if (postId) {
                this.loadPostData(postId);
            } else {
                this.resetPostForm();
            }
        }
    }

    closePostModal() {
        const modal = document.getElementById('postModal');
        if (modal) {
            modal.style.display = 'none';
            this.resetPostForm();
        }
    }

    openRoleModal(roleId = null) {
        const modal = document.getElementById('roleModal');
        if (modal) {
            modal.style.display = 'block';
            if (roleId) {
                this.loadRoleData(roleId);
            } else {
                this.resetRoleForm();
            }
        }
    }

    closeRoleModal() {
        const modal = document.getElementById('roleModal');
        if (modal) {
            modal.style.display = 'none';
            this.resetRoleForm();
        }
    }

    resetPostForm() {
        const form = document.getElementById('postForm');
        if (form) {
            form.reset();
            const editor = document.getElementById('editor');
            if (editor && editor.__quill) {
                editor.__quill.setText('');
            }
            document.getElementById('imagePreview').innerHTML = '<i class="fas fa-image"></i>';
            document.getElementById('excerptCount').textContent = '0/200';
        }
    }

    resetRoleForm() {
        const form = document.getElementById('roleForm');
        if (form) {
            form.reset();
            // Load permissions instead of calling renderPermissions without parameters
            this.loadPermissions();
        }
    }

    updateUserRoles(userId, roles) {
        const userRow = document.querySelector(`[data-user-id="${userId}"]`);
        if (!userRow) return;
        
        const rolesCell = userRow.querySelector('.user-roles');
        if (rolesCell) {
            rolesCell.innerHTML = roles.map(role => 
                `<span class="role-badge">${role.name}</span>`
            ).join('');
        }
    }

    selectAllPermissions() {
        const checkboxes = document.querySelectorAll('#permissionsGrid input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    deselectAllPermissions() {
        const checkboxes = document.querySelectorAll('#permissionsGrid input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    async manageUserRoles(userId) {
        try {
            // Load user details and roles
            const [userResponse, rolesResponse, userRolesResponse] = await Promise.all([
                fetch(`/api/admin/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                }),
                fetch('/api/admin/roles', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                }),
                fetch(`/api/admin/users/${userId}/roles`, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                })
            ]);

            const user = await userResponse.json();
            const roles = await rolesResponse.json();
            const userRoles = await userRolesResponse.json();

            // Create role management modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Manage Roles for ${user.user.display_name || user.user.username}</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-roles-section">
                            <h4>Current Roles</h4>
                            <div class="current-roles">
                                ${userRoles.roles && userRoles.roles.length > 0 ? 
                                    userRoles.roles.map(role => 
                                        `<span class="role-badge remove" onclick="adminPanel.removeUserRole(${userId}, ${role.id})">
                                            ${role.name} <i class="fas fa-times"></i>
                                        </span>`
                                    ).join('') : 
                                    '<p>No roles assigned</p>'
                                }
                            </div>
                        </div>
                        
                        <div class="user-roles-section">
                            <h4>Add New Role</h4>
                            <div class="add-role-form">
                                <select id="newRoleSelect">
                                    <option value="">Select a role...</option>
                                    ${roles.roles.filter(role => 
                                        !userRoles.roles || !userRoles.roles.find(ur => ur.id === role.id)
                                    ).map(role => 
                                        `<option value="${role.id}">${role.name}</option>`
                                    ).join('')}
                                </select>
                                <button class="btn btn-primary" onclick="adminPanel.addUserRole(${userId})">
                                    <i class="fas fa-plus"></i> Add Role
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        } catch (error) {
            console.error('Error managing user roles:', error);
            alert('Error loading user roles');
        }
    }

    async addUserRole(userId) {
        const roleSelect = document.getElementById('newRoleSelect');
        const roleId = roleSelect.value;
        
        if (!roleId) {
            alert('Please select a role');
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}/roles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ roleId: parseInt(roleId) })
            });

            if (response.ok) {
                alert('Role added successfully!');
                this.loadUsers(); // Refresh the users table
                document.querySelector('.modal').remove();
            } else {
                const data = await response.json();
                alert(data.message || 'Error adding role');
            }
        } catch (error) {
            console.error('Error adding user role:', error);
            alert('Error adding role');
        }
    }

    async removeUserRole(userId, roleId) {
        if (!confirm('Are you sure you want to remove this role?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}/roles/${roleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                alert('Role removed successfully!');
                this.loadUsers(); // Refresh the users table
                document.querySelector('.modal').remove();
            } else {
                const data = await response.json();
                alert(data.message || 'Error removing role');
            }
        } catch (error) {
            console.error('Error removing user role:', error);
            alert('Error removing role');
        }
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel(); 