// Apply theme immediately to prevent flash
(function() {
    // Check for system preference on first visit
    if (!localStorage.getItem('theme')) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const defaultTheme = prefersDark ? 'dark' : 'light';
        localStorage.setItem('theme', defaultTheme);
    }
    
    // Get the current theme and apply it immediately
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
})();

// Theme Toggle Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme icon
    updateThemeIcon(document.documentElement.getAttribute('data-theme') || 'light');

    // Add click event listener to theme toggle button
    document.addEventListener('click', (event) => {
        if (event.target.closest('.theme-toggle')) {
            toggleTheme();
        }
    });
});

function updateThemeIcon(theme) {
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Set the theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update the icon
    updateThemeIcon(newTheme);
    
    // Add a smooth transition effect
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    // Force a repaint to ensure styles are applied
    document.body.offsetHeight; // Trigger reflow
    
    // Remove transition after animation completes
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
} 