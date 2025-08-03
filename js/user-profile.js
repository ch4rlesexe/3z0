// User Profile JavaScript
class UserProfile {
    constructor() {
        this.currentUser = null;
        this.profileUser = null;
        this.authToken = localStorage.getItem('authToken');
        
        this.init();
    }
    
    init() {
        this.loadProfileData();
        this.setupEventListeners();
    }
    
    async loadProfileData() {
        // Get username from URL path
        const pathParts = window.location.pathname.split('/');
        const username = pathParts[pathParts.length - 1] || 'admin'; // Default to admin for testing
        
        try {
            const response = await fetch(`/api/users/${username}/profile`);
            const data = await response.json();
            
            if (response.ok) {
                this.profileUser = data.user;
                this.renderProfile();
                this.loadWallMessages();
                this.loadRecentPosts();
            } else {
                this.showError('User not found');
            }
        } catch (error) {
            console.error('Profile load error:', error);
            this.showError('Failed to load profile');
        }
    }
    
    renderProfile() {
        const user = this.profileUser;
        
        // Update profile info
        document.getElementById('displayName').textContent = user.display_name || `${user.first_name} ${user.last_name}`;
        document.getElementById('username').textContent = `@${user.username}`;
        document.getElementById('bio').textContent = user.bio || 'No bio yet';
        document.getElementById('postsCount').textContent = user.posts_count || 0;
        document.getElementById('wallMessagesCount').textContent = user.wall_messages_count || 0;
        document.getElementById('memberSince').textContent = new Date(user.created_at).getFullYear();
        
        // Update avatar
        const avatar = document.getElementById('profileAvatar');
        if (user.profile_picture) {
            avatar.innerHTML = `<img src="/uploads/${user.profile_picture}" alt="${user.display_name}">`;
        } else {
            avatar.innerHTML = `<i class="fas fa-user"></i>`;
        }
        
        // Update banner
        const banner = document.getElementById('profileBanner');
        if (user.banner_image) {
            banner.style.backgroundImage = `url(/uploads/${user.banner_image})`;
        }
        
        // Update social links
        this.renderSocialLinks(user.social_links || {});
        
        // Update page title
        document.title = `${user.display_name || user.username} - 3Z0 Blog`;
    }
    
    renderSocialLinks(socialLinks) {
        const container = document.getElementById('socialLinks');
        
        if (Object.keys(socialLinks).length === 0) {
            container.innerHTML = '<div class="no-links">No social links added</div>';
            return;
        }
        
        const links = [];
        
        if (socialLinks.website) {
            links.push(`
                <a href="${socialLinks.website}" class="social-link" target="_blank" rel="noopener">
                    <i class="fas fa-globe"></i>
                    <span>Website</span>
                </a>
            `);
        }
        
        if (socialLinks.github) {
            links.push(`
                <a href="https://github.com/${socialLinks.github}" class="social-link" target="_blank" rel="noopener">
                    <i class="fab fa-github"></i>
                    <span>GitHub</span>
                </a>
            `);
        }
        
        if (socialLinks.twitter) {
            links.push(`
                <a href="https://twitter.com/${socialLinks.twitter}" class="social-link" target="_blank" rel="noopener">
                    <i class="fab fa-twitter"></i>
                    <span>Twitter</span>
                </a>
            `);
        }
        
        if (socialLinks.linkedin) {
            links.push(`
                <a href="https://linkedin.com/in/${socialLinks.linkedin}" class="social-link" target="_blank" rel="noopener">
                    <i class="fab fa-linkedin"></i>
                    <span>LinkedIn</span>
                </a>
            `);
        }
        
        if (socialLinks.instagram) {
            links.push(`
                <a href="https://instagram.com/${socialLinks.instagram}" class="social-link" target="_blank" rel="noopener">
                    <i class="fab fa-instagram"></i>
                    <span>Instagram</span>
                </a>
            `);
        }
        
        if (socialLinks.youtube) {
            links.push(`
                <a href="https://youtube.com/${socialLinks.youtube}" class="social-link" target="_blank" rel="noopener">
                    <i class="fab fa-youtube"></i>
                    <span>YouTube</span>
                </a>
            `);
        }
        
        container.innerHTML = links.join('');
    }
    
    async loadRecentPosts() {
        if (!this.profileUser) return;
        
        try {
            const response = await fetch(`/api/users/${this.profileUser.username}/posts?limit=5`);
            const data = await response.json();
            
            if (response.ok) {
                this.renderRecentPosts(data.posts || []);
            }
        } catch (error) {
            console.error('Recent posts load error:', error);
        }
    }
    
    renderRecentPosts(posts) {
        const container = document.getElementById('recentPosts');
        
        if (posts.length === 0) {
            container.innerHTML = '<div class="no-posts">No posts yet</div>';
            return;
        }
        
        container.innerHTML = posts.map(post => `
            <div class="recent-post">
                <h4><a href="/blog/${post.slug}" style="color: inherit; text-decoration: none;">${post.title}</a></h4>
                <p>${post.excerpt || post.content.substring(0, 100)}...</p>
                <span class="post-date">${new Date(post.created_at).toLocaleDateString()}</span>
            </div>
        `).join('');
    }
    
    async loadWallMessages() {
        if (!this.profileUser) return;
        
        try {
            const response = await fetch(`/api/users/${this.profileUser.username}/wall`);
            const data = await response.json();
            
            if (response.ok) {
                this.renderWallMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Wall messages load error:', error);
        }
    }
    
    renderWallMessages(messages) {
        const container = document.getElementById('wallMessages');
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="no-messages">No messages yet. Be the first to leave one!</div>';
            return;
        }
        
        container.innerHTML = messages.map(message => `
            <div class="wall-message">
                <div class="message-avatar">
                    ${message.author.profile_picture 
                        ? `<img src="/uploads/${message.author.profile_picture}" alt="${message.author.display_name}">`
                        : `<i class="fas fa-user"></i>`
                    }
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">${message.author.display_name || message.author.username}</span>
                        <span class="message-date">${new Date(message.created_at).toLocaleDateString()}</span>
                    </div>
                    <p class="message-text">${this.escapeHtml(message.message)}</p>
                </div>
            </div>
        `).join('');
    }
    
    setupEventListeners() {
        // Character count for message textarea
        const messageText = document.getElementById('messageText');
        const charCount = document.getElementById('charCount');
        const postBtn = document.getElementById('postMessageBtn');
        
        if (messageText) {
            messageText.addEventListener('input', () => {
                const length = messageText.value.length;
                charCount.textContent = `${length}/500`;
                
                if (length > 500) {
                    charCount.style.color = 'var(--profile-danger)';
                    postBtn.disabled = true;
                } else {
                    charCount.style.color = 'var(--text-secondary)';
                    postBtn.disabled = false;
                }
            });
        }
        
        // Post message button
        if (postBtn) {
            postBtn.addEventListener('click', () => {
                this.postMessage();
            });
        }
        
        // Enter key to post message
        if (messageText) {
            messageText.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    this.postMessage();
                }
            });
        }
    }
    
    async postMessage() {
        if (!this.authToken) {
            this.showError('Please log in to post a message');
            return;
        }
        
        if (!this.profileUser) {
            this.showError('Profile not loaded');
            return;
        }
        
        const messageText = document.getElementById('messageText');
        const message = messageText.value.trim();
        
        if (!message) {
            this.showError('Please enter a message');
            return;
        }
        
        if (message.length > 500) {
            this.showError('Message is too long (max 500 characters)');
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${this.profileUser.username}/wall`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                messageText.value = '';
                document.getElementById('charCount').textContent = '0/500';
                this.loadWallMessages(); // Reload messages
                this.showSuccess('Message posted successfully!');
            } else {
                this.showError(data.message || 'Failed to post message');
            }
        } catch (error) {
            console.error('Post message error:', error);
            this.showError('Failed to post message');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `profile-message profile-message-${type}`;
        messageEl.textContent = message;
        
        // Add styles
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            z-index: 1000;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease;
        `;
        
        // Set background color based on type
        switch (type) {
            case 'error':
                messageEl.style.backgroundColor = 'var(--profile-danger)';
                break;
            case 'success':
                messageEl.style.backgroundColor = 'var(--profile-success)';
                break;
            default:
                messageEl.style.backgroundColor = 'var(--profile-primary)';
        }
        
        // Add to page
        document.body.appendChild(messageEl);
        
        // Remove after 3 seconds
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize user profile
const userProfile = new UserProfile(); 