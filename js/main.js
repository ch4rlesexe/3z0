// Navigation menu toggle
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        // No menu-toggle class changes - keep it static
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
            navLinks.classList.remove('active');
            // No menu-toggle class changes - keep it static
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Handle auth buttons visibility
    updateAuthButtonsVisibility();
    
    // Setup user menu functionality
    setupUserMenu();
    
    // Load user data if logged in
    if (localStorage.getItem('authToken')) {
        loadUserData();
    }
});

// Function to update auth buttons visibility based on authentication status
function updateAuthButtonsVisibility() {
    const authToken = localStorage.getItem('authToken');
    const authButtons = document.getElementById('authButtons');
    const mobileAuthButtons = document.getElementById('mobileAuthButtons');
    const userMenu = document.getElementById('userMenu');
    
    if (authToken) {
        // User is logged in
        if (authButtons) authButtons.style.display = 'none';
        if (mobileAuthButtons) mobileAuthButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
    } else {
        // User is not logged in
        if (authButtons) authButtons.style.display = 'flex';
        // Don't override CSS for mobile auth buttons - let CSS handle visibility
        if (userMenu) userMenu.style.display = 'none';
    }
}

// Setup user menu functionality
function setupUserMenu() {
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (userDropdown) {
            userDropdown.classList.remove('active');
        }
    });
    
    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// Load user data
async function loadUserData() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            updateUserMenu(user);
        } else {
            // Token might be invalid, clear it
            localStorage.removeItem('authToken');
            updateAuthButtonsVisibility();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update user menu with user data
function updateUserMenu(user) {
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const adminOnly = document.querySelector('.admin-only');
    const publicProfileLink = document.getElementById('publicProfileLink');
    
    if (userName) {
        userName.textContent = user.display_name || user.username;
    }
    
    if (userAvatar) {
        if (user.profile_picture) {
            userAvatar.innerHTML = `<img src="/uploads/${user.profile_picture}" alt="${user.display_name || user.username}">`;
        } else {
            userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
        }
    }
    
    // Set public profile link
    if (publicProfileLink) {
        publicProfileLink.href = `/user/${user.username}`;
    }
    
    // Show admin panel link for admins
    if (adminOnly && user.is_admin) {
        adminOnly.style.display = 'block';
    }
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    updateAuthButtonsVisibility();
    
    // Redirect to home page
    window.location.href = '/';
}

// Add scroll animation for elements
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.post-card, .team-member, .about-section').forEach(el => {
    observer.observe(el);
});