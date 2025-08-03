class Analytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.pageStartTime = Date.now();
        this.userId = this.getUserId();
        this.trackPageView();
        this.setupEventListeners();
        this.setupPageTracking();
        this.setupSearchTracking();
        this.setupUserBehaviorTracking();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getUserId() {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.userId;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    async getDeviceInfo() {
        const userAgent = navigator.userAgent;
        let deviceType = 'desktop';
        let browser = 'Unknown';
        let os = 'Unknown';

        // Detect device type
        if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
            deviceType = 'mobile';
        } else if (/Tablet|iPad/.test(userAgent)) {
            deviceType = 'tablet';
        }

        // Detect browser
        if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Safari')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';
        else if (userAgent.includes('Opera')) browser = 'Opera';

        // Detect OS
        if (userAgent.includes('Windows')) os = 'Windows';
        else if (userAgent.includes('Mac')) os = 'macOS';
        else if (userAgent.includes('Linux')) os = 'Linux';
        else if (userAgent.includes('Android')) os = 'Android';
        else if (userAgent.includes('iOS')) os = 'iOS';

        return { deviceType, browser, os };
    }

    async getGeographicInfo() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            return {
                country: data.country_name || null,
                region: data.region || null,
                city: data.city || null,
                ip: data.ip || null
            };
        } catch (error) {
            console.warn('Could not get geographic info:', error);
            return { country: null, region: null, city: null, ip: null };
        }
    }

    async trackPageView() {
        const deviceInfo = await this.getDeviceInfo();
        const geoInfo = await this.getGeographicInfo();
        
        const data = {
            page_url: window.location.href || null,
            session_id: this.sessionId || null,
            user_id: this.userId || null,
            ip_address: geoInfo.ip || null,
            user_agent: navigator.userAgent || null,
            referrer: document.referrer || null,
            country: geoInfo.country || null,
            region: geoInfo.region || null,
            city: geoInfo.city || null,
            device_type: deviceInfo.deviceType || null,
            browser: deviceInfo.browser || null,
            os: deviceInfo.os || null,
            view_duration: 0
        };

        try {
            await fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.warn('Failed to track page view:', error);
        }
    }

    setupEventListeners() {
        // Track clicks on important elements
        document.addEventListener('click', (e) => {
            const target = e.target.closest('a, button, .btn, [data-track]');
            if (target) {
                this.trackEvent('click', {
                    element: target.tagName.toLowerCase(),
                    text: target.textContent?.trim().substring(0, 50),
                    href: target.href,
                    className: target.className,
                    id: target.id
                });
            }
        });

        // Track form submissions
        document.addEventListener('submit', (e) => {
            this.trackEvent('form_submit', {
                form: e.target.id || e.target.className,
                action: e.target.action
            });
        });

        // Track scroll depth
        let maxScroll = 0;
        document.addEventListener('scroll', () => {
            const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                if (maxScroll % 25 === 0) { // Track at 25%, 50%, 75%, 100%
                    this.trackEvent('scroll_depth', { depth: maxScroll });
                }
            }
        });

        // Track time on page
        setInterval(() => {
            const timeOnPage = Math.round((Date.now() - this.pageStartTime) / 1000);
            if (timeOnPage % 30 === 0 && timeOnPage > 0) { // Track every 30 seconds
                this.trackEvent('time_on_page', { seconds: timeOnPage });
            }
        }, 1000);
    }

    setupPageTracking() {
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', { duration: Date.now() - this.pageStartTime });
            } else {
                this.pageStartTime = Date.now();
                this.trackEvent('page_visible');
            }
        });

        // Track before unload
        window.addEventListener('beforeunload', () => {
            const duration = Date.now() - this.pageStartTime;
            this.trackEvent('page_exit', { duration });
            
            // Send final page view with duration
            this.sendBeacon('/api/analytics/track', {
                page_url: window.location.href || null,
                session_id: this.sessionId || null,
                user_id: this.userId || null,
                view_duration: Math.round(duration / 1000)
            });
        });
    }

    setupSearchTracking() {
        // Track search functionality
        const searchForms = document.querySelectorAll('form[action*="search"], input[type="search"]');
        searchForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const searchInput = form.querySelector('input[type="search"], input[name*="search"], input[name*="q"]');
                if (searchInput) {
                    this.trackSearch(searchInput.value, 0, false);
                }
            });
        });
    }

    setupUserBehaviorTracking() {
        // Track mouse movements (heatmap-like data)
        let mouseMovements = 0;
        document.addEventListener('mousemove', () => {
            mouseMovements++;
            if (mouseMovements % 100 === 0) {
                this.trackEvent('mouse_movement', { count: mouseMovements });
            }
        });

        // Track keyboard activity
        let keyPresses = 0;
        document.addEventListener('keydown', () => {
            keyPresses++;
            if (keyPresses % 10 === 0) {
                this.trackEvent('keyboard_activity', { count: keyPresses });
            }
        });

        // Track window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.trackEvent('window_resize', {
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }, 500);
        });
    }

    async trackEvent(eventType, eventData = {}) {
        const data = {
            user_id: this.userId || null,
            session_id: this.sessionId || null,
            event_type: eventType || null,
            event_data: eventData || null,
            ip_address: null // Will be set by server
        };

        try {
            await fetch('/api/analytics/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.warn('Failed to track event:', error);
        }
    }

    async trackSearch(query, resultsCount = 0, clickedResult = false) {
        const data = {
            user_id: this.userId || null,
            session_id: this.sessionId || null,
            query: query || null,
            results_count: resultsCount || 0,
            clicked_result: clickedResult || false,
            ip_address: null
        };

        try {
            await fetch('/api/analytics/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.warn('Failed to track search:', error);
        }
    }

    sendBeacon(url, data) {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, JSON.stringify(data));
        }
    }

    // Public methods for manual tracking
    trackCustomEvent(eventType, eventData) {
        this.trackEvent(eventType, eventData);
    }

    trackCustomSearch(query, resultsCount, clickedResult) {
        this.trackSearch(query, resultsCount, clickedResult);
    }
}

// Initialize analytics when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analytics = new Analytics();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analytics;
} 