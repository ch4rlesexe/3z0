const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public tracking routes (no authentication required)
router.post('/track', async (req, res) => {
    try {
        const {
            page_url, session_id, user_id, ip_address, user_agent, referrer,
            country, region, city, device_type, browser, os, view_duration
        } = req.body;

        // Convert undefined values to null for database, but ensure required fields are never null
        const params = [
            page_url || '/unknown',
            session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id || null,
            ip_address || null,
            user_agent || null,
            referrer || null,
            country || null,
            region || null,
            city || null,
            device_type || null,
            browser || null,
            os || null,
            view_duration || 0
        ];

        await pool.execute(`
            INSERT INTO page_views (
                page_url, session_id, user_id, ip_address, user_agent, referrer,
                country, region, city, device_type, browser, os, view_duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, params);

        res.status(200).json({ message: 'Page view tracked' });
    } catch (error) {
        console.error('Track page view error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/event', async (req, res) => {
    try {
        const { session_id, user_id, event_type, event_data } = req.body;

        // Convert undefined values to null for database, but ensure session_id is never null
        const params = [
            session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id || null,
            event_type || null,
            event_data ? JSON.stringify(event_data) : null
        ];

        await pool.execute(`
            INSERT INTO user_events (session_id, user_id, event_type, event_data)
            VALUES (?, ?, ?, ?)
        `, params);

        res.status(200).json({ message: 'Event tracked' });
    } catch (error) {
        console.error('Track event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/search', async (req, res) => {
    try {
        const { session_id, user_id, query, results_count, clicked_result } = req.body;

        // Convert undefined values to null for database, but ensure session_id is never null
        const params = [
            session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id || null,
            query || null,
            results_count || 0,
            clicked_result || false
        ];

        await pool.execute(`
            INSERT INTO search_queries (session_id, user_id, query, results_count, clicked_result)
            VALUES (?, ?, ?, ?, ?)
        `, params);

        res.status(200).json({ message: 'Search tracked' });
    } catch (error) {
        console.error('Track search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Track session start
router.post('/session/start', async (req, res) => {
    try {
        const { user_id, session_id } = req.body;
        
        if (!session_id) {
            return res.status(400).json({ message: 'Session ID is required' });
        }
        
        // Insert session start record
        await pool.execute(`
            INSERT INTO user_session_time (user_id, session_id, start_time)
            VALUES (?, ?, NOW())
        `, [user_id || null, session_id]);
        
        res.status(200).json({ message: 'Session started' });
    } catch (error) {
        console.error('Session start error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Track session end
router.post('/session/end', async (req, res) => {
    try {
        const { session_id } = req.body;
        
        if (!session_id) {
            return res.status(400).json({ message: 'Session ID is required' });
        }
        
        // Update session end time and calculate duration
        await pool.execute(`
            UPDATE user_session_time 
            SET end_time = NOW(), 
                duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW())
            WHERE session_id = ? AND end_time IS NULL
        `, [session_id]);
        
        res.status(200).json({ message: 'Session ended' });
    } catch (error) {
        console.error('Session end error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's total session time
router.get('/user/:userId/session-time', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get total session time for user
        const [result] = await pool.execute(`
            SELECT 
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COUNT(*) as session_count,
                COALESCE(AVG(duration_seconds), 0) as avg_session_seconds
            FROM user_session_time 
            WHERE user_id = ? AND end_time IS NOT NULL
        `, [userId]);
        
        const totalSeconds = result[0].total_seconds;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        res.json({
            total_seconds: totalSeconds,
            formatted_time: `${hours}h ${minutes}m ${seconds}s`,
            session_count: result[0].session_count,
            avg_session_seconds: result[0].avg_session_seconds
        });
    } catch (error) {
        console.error('Get session time error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin-only routes (require authentication)
const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireAdmin);

// Get comprehensive analytics dashboard
adminRouter.get('/dashboard', async (req, res) => {
    try {
        const period = req.query.period || 30; // days

        // Basic stats
        const [basicStats] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM posts WHERE status = 'published') as total_posts,
                (SELECT COUNT(*) FROM comments WHERE is_approved = TRUE) as total_comments,
                (SELECT COUNT(*) FROM page_views) as total_views,
                (SELECT COUNT(DISTINCT session_id) FROM user_sessions) as total_sessions,
                (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE user_id IS NOT NULL) as unique_users
        `);

        // Page views over time
        const [pageViewsData] = await pool.execute(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                COUNT(DISTINCT user_id) as unique_users
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [period]);

        // Real-time traffic (last 24 hours by hour)
        const [realtimeTraffic] = await pool.execute(`
            SELECT 
                HOUR(created_at) as hour,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
            GROUP BY HOUR(created_at)
            ORDER BY hour
        `);

        // Weekly traffic pattern
        const [weeklyTraffic] = await pool.execute(`
            SELECT 
                DAYOFWEEK(created_at) as day_of_week,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DAYOFWEEK(created_at)
            ORDER BY day_of_week
        `, [period]);

        // Top pages
        const [topPages] = await pool.execute(`
            SELECT 
                page_url,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                AVG(view_duration) as avg_duration,
                (COUNT(CASE WHEN view_duration < 10 THEN 1 END) * 100.0 / COUNT(*)) as bounce_rate
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY page_url
            ORDER BY views DESC
            LIMIT 10
        `, [period]);

        // Geographic data
        const [geographicData] = await pool.execute(`
            SELECT 
                country,
                region,
                city,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND country IS NOT NULL
            GROUP BY country, region, city
            ORDER BY views DESC
            LIMIT 20
        `, [period]);

        // Device and browser stats
        const [deviceStats] = await pool.execute(`
            SELECT 
                device_type,
                browser,
                os,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY device_type, browser, os
            ORDER BY views DESC
        `, [period]);

        // User engagement
        const [engagementStats] = await pool.execute(`
            SELECT 
                AVG(duration) as avg_session_duration,
                AVG(page_count) as avg_pages_per_session,
                COUNT(*) as total_sessions
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [period]);

        // User events
        const [eventStats] = await pool.execute(`
            SELECT 
                event_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
            FROM user_events
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY event_type
            ORDER BY count DESC
        `, [period]);

        // Search analytics
        const [searchStats] = await pool.execute(`
            SELECT 
                query,
                COUNT(*) as searches,
                AVG(results_count) as avg_results,
                SUM(clicked_result) as clicks,
                (SUM(clicked_result) * 100.0 / COUNT(*)) as ctr
            FROM search_queries
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY query
            ORDER BY searches DESC
            LIMIT 20
        `, [period]);

        // User registration trends
        const [userTrends] = await pool.execute(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as registrations
            FROM users
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [period]);

        // Post performance
        const [postPerformance] = await pool.execute(`
            SELECT 
                p.title,
                p.slug,
                p.view_count,
                COUNT(c.id) as comment_count,
                COUNT(r.id) as reaction_count,
                p.created_at
            FROM posts p
            LEFT JOIN comments c ON p.id = c.post_id AND c.is_approved = TRUE
            LEFT JOIN reactions r ON p.id = r.post_id
            WHERE p.status = 'published'
            GROUP BY p.id
            ORDER BY p.view_count DESC
            LIMIT 10
        `);

        // Real-time stats (last 24 hours)
        const [realtimeStats] = await pool.execute(`
            SELECT 
                COUNT(*) as views_24h,
                COUNT(DISTINCT session_id) as sessions_24h,
                COUNT(DISTINCT user_id) as users_24h
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        `);

        // Bounce rate calculation
        const [bounceRate] = await pool.execute(`
            SELECT 
                (COUNT(CASE WHEN page_count = 1 THEN 1 END) * 100.0 / COUNT(*)) as bounce_rate
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [period]);

        // Top referrers
        const [topReferrers] = await pool.execute(`
            SELECT 
                referrer,
                COUNT(*) as visits,
                COUNT(DISTINCT user_id) as users,
                AVG(view_duration) as avg_session
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND referrer IS NOT NULL
            AND referrer != ''
            GROUP BY referrer
            ORDER BY visits DESC
            LIMIT 10
        `, [period]);

        // User retention (users who visited multiple days)
        const [userRetention] = await pool.execute(`
            SELECT 
                days_visited,
                COUNT(*) as users
            FROM (
                SELECT 
                    user_id,
                    COUNT(DISTINCT DATE(created_at)) as days_visited
                FROM page_views
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND user_id IS NOT NULL
                GROUP BY user_id
            ) as user_days
            GROUP BY days_visited
            ORDER BY days_visited
        `, [period]);

        // Session duration distribution
        const [sessionDurations] = await pool.execute(`
            SELECT 
                CASE 
                    WHEN duration < 60 THEN '0-1 min'
                    WHEN duration < 300 THEN '1-5 min'
                    WHEN duration < 900 THEN '5-15 min'
                    WHEN duration < 1800 THEN '15-30 min'
                    ELSE '30+ min'
                END as duration_range,
                COUNT(*) as sessions
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND duration > 0
            GROUP BY duration_range
            ORDER BY MIN(duration)
        `, [period]);

        // Pages per session distribution
        const [pagesPerSession] = await pool.execute(`
            SELECT 
                CASE 
                    WHEN page_count = 1 THEN '1 page'
                    WHEN page_count <= 3 THEN '2-3 pages'
                    WHEN page_count <= 5 THEN '4-5 pages'
                    WHEN page_count <= 10 THEN '6-10 pages'
                    ELSE '10+ pages'
                END as page_range,
                COUNT(*) as sessions
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY page_range
            ORDER BY MIN(page_count)
        `, [period]);

        // Bounce rate trends over time
        const [bounceRateTrends] = await pool.execute(`
            SELECT 
                DATE(started_at) as date,
                (COUNT(CASE WHEN page_count = 1 THEN 1 END) * 100.0 / COUNT(*)) as bounce_rate
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(started_at)
            ORDER BY date
        `, [period]);

        res.json({
            basicStats: basicStats[0],
            pageViewsData,
            realtimeTraffic,
            weeklyTraffic,
            topPages,
            geographicData,
            deviceStats,
            engagementStats: engagementStats[0],
            eventStats,
            searchStats,
            userTrends,
            postPerformance,
            realtimeStats: realtimeStats[0],
            bounceRate: bounceRate[0]?.bounce_rate || 0,
            topReferrers,
            userRetention,
            sessionDurations,
            pagesPerSession,
            bounceRateTrends
        });

    } catch (error) {
        console.error('Analytics dashboard error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get detailed geographic analytics
adminRouter.get('/geographic', async (req, res) => {
    try {
        const period = req.query.period || 30;

        // Country breakdown
        const [countries] = await pool.execute(`
            SELECT 
                country,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(view_duration) as avg_duration
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND country IS NOT NULL
            GROUP BY country
            ORDER BY views DESC
        `, [period]);

        // Regional breakdown
        const [regions] = await pool.execute(`
            SELECT 
                country,
                region,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                AVG(view_duration) as avg_duration
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND region IS NOT NULL
            GROUP BY country, region
            ORDER BY views DESC
            LIMIT 50
        `, [period]);

        // City breakdown
        const [cities] = await pool.execute(`
            SELECT 
                country,
                region,
                city,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(view_duration) as avg_duration
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND city IS NOT NULL
            GROUP BY country, region, city
            ORDER BY views DESC
            LIMIT 100
        `, [period]);

        // Geographic trends over time
        const [geographicTrends] = await pool.execute(`
            SELECT 
                DATE(created_at) as date,
                country,
                COUNT(*) as views
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND country IS NOT NULL
            GROUP BY DATE(created_at), country
            ORDER BY date, views DESC
        `, [period]);

        res.json({
            countries,
            regions,
            cities,
            geographicTrends
        });

    } catch (error) {
        console.error('Geographic analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get detailed referrer analytics
adminRouter.get('/referrers', async (req, res) => {
    try {
        const period = req.query.period || 30;

        // Top referrers
        const [topReferrers] = await pool.execute(`
            SELECT 
                referrer,
                COUNT(*) as visits,
                COUNT(DISTINCT user_id) as users,
                COUNT(DISTINCT session_id) as sessions,
                AVG(view_duration) as avg_duration,
                (COUNT(CASE WHEN view_duration < 10 THEN 1 END) * 100.0 / COUNT(*)) as bounce_rate
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND referrer IS NOT NULL
            AND referrer != ''
            GROUP BY referrer
            ORDER BY visits DESC
            LIMIT 20
        `, [period]);

        // Referrer trends over time
        const [referrerTrends] = await pool.execute(`
            SELECT 
                DATE(created_at) as date,
                referrer,
                COUNT(*) as visits
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND referrer IS NOT NULL
            AND referrer != ''
            GROUP BY DATE(created_at), referrer
            ORDER BY date, visits DESC
        `, [period]);

        // Direct traffic vs referrers
        const [trafficSources] = await pool.execute(`
            SELECT 
                CASE 
                    WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
                    WHEN referrer LIKE '%google%' THEN 'Google'
                    WHEN referrer LIKE '%facebook%' THEN 'Facebook'
                    WHEN referrer LIKE '%twitter%' THEN 'Twitter'
                    WHEN referrer LIKE '%linkedin%' THEN 'LinkedIn'
                    WHEN referrer LIKE '%youtube%' THEN 'YouTube'
                    WHEN referrer LIKE '%reddit%' THEN 'Reddit'
                    ELSE 'Other'
                END as source,
                COUNT(*) as visits,
                COUNT(DISTINCT user_id) as users
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY source
            ORDER BY visits DESC
        `, [period]);

        res.json({
            topReferrers,
            referrerTrends,
            trafficSources
        });

    } catch (error) {
        console.error('Referrer analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get detailed user sessions
adminRouter.get('/sessions', async (req, res) => {
    try {
        const period = req.query.period || 30;

        // Recent sessions
        const [recentSessions] = await pool.execute(`
            SELECT 
                s.session_id,
                s.user_id,
                u.username,
                s.duration,
                s.page_count,
                s.country,
                s.city,
                s.device_type,
                s.browser,
                s.os,
                s.started_at,
                s.ended_at
            FROM user_sessions s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY s.started_at DESC
            LIMIT 50
        `, [period]);

        // Session statistics
        const [sessionStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_sessions,
                AVG(duration) as avg_duration,
                AVG(page_count) as avg_pages,
                MIN(duration) as min_duration,
                MAX(duration) as max_duration,
                COUNT(CASE WHEN page_count = 1 THEN 1 END) as bounce_sessions
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [period]);

        // Sessions by device type
        const [sessionsByDevice] = await pool.execute(`
            SELECT 
                device_type,
                COUNT(*) as sessions,
                AVG(duration) as avg_duration,
                AVG(page_count) as avg_pages
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY device_type
            ORDER BY sessions DESC
        `, [period]);

        res.json({
            recentSessions,
            sessionStats: sessionStats[0],
            sessionsByDevice
        });

    } catch (error) {
        console.error('Session analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get comprehensive device analytics
adminRouter.get('/devices', async (req, res) => {
    try {
        const period = req.query.period || 30;

        // Device types
        const [deviceTypes] = await pool.execute(`
            SELECT 
                device_type,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                COUNT(DISTINCT user_id) as users,
                AVG(view_duration) as avg_duration,
                (COUNT(CASE WHEN view_duration < 10 THEN 1 END) * 100.0 / COUNT(*)) as bounce_rate
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY device_type
            ORDER BY views DESC
        `, [period]);

        // Browsers
        const [browsers] = await pool.execute(`
            SELECT 
                browser,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                COUNT(DISTINCT user_id) as users,
                AVG(view_duration) as avg_duration
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND browser IS NOT NULL
            GROUP BY browser
            ORDER BY views DESC
            LIMIT 15
        `, [period]);

        // Operating systems
        const [operatingSystems] = await pool.execute(`
            SELECT 
                os,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions,
                COUNT(DISTINCT user_id) as users,
                AVG(view_duration) as avg_duration
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND os IS NOT NULL
            GROUP BY os
            ORDER BY views DESC
            LIMIT 15
        `, [period]);

        // Device combinations
        const [deviceCombinations] = await pool.execute(`
            SELECT 
                device_type,
                browser,
                os,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as sessions
            FROM page_views
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY device_type, browser, os
            ORDER BY views DESC
            LIMIT 20
        `, [period]);

        res.json({
            deviceTypes,
            browsers,
            operatingSystems,
            deviceCombinations
        });

    } catch (error) {
        console.error('Device analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user behavior analytics
adminRouter.get('/behavior', async (req, res) => {
    try {
        const period = req.query.period || 30;

        // Session duration distribution
        const [sessionDurations] = await pool.execute(`
            SELECT 
                CASE 
                    WHEN duration < 60 THEN '0-1 min'
                    WHEN duration < 300 THEN '1-5 min'
                    WHEN duration < 900 THEN '5-15 min'
                    WHEN duration < 1800 THEN '15-30 min'
                    ELSE '30+ min'
                END as duration_range,
                COUNT(*) as sessions
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND duration > 0
            GROUP BY duration_range
            ORDER BY MIN(duration)
        `, [period]);

        // Pages per session
        const [pagesPerSession] = await pool.execute(`
            SELECT 
                CASE 
                    WHEN page_count = 1 THEN '1 page'
                    WHEN page_count <= 3 THEN '2-3 pages'
                    WHEN page_count <= 5 THEN '4-5 pages'
                    WHEN page_count <= 10 THEN '6-10 pages'
                    ELSE '10+ pages'
                END as page_range,
                COUNT(*) as sessions
            FROM user_sessions
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY page_range
            ORDER BY MIN(page_count)
        `, [period]);

        // User events
        const [userEvents] = await pool.execute(`
            SELECT 
                event_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
            FROM user_events
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY event_type
            ORDER BY count DESC
        `, [period]);

        // Search behavior
        const [searchBehavior] = await pool.execute(`
            SELECT 
                AVG(results_count) as avg_results,
                SUM(clicked_result) * 100.0 / COUNT(*) as click_through_rate,
                COUNT(*) as total_searches
            FROM search_queries
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [period]);

        res.json({
            sessionDurations,
            pagesPerSession,
            userEvents,
            searchBehavior: searchBehavior[0]
        });

    } catch (error) {
        console.error('Behavior analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = { router, adminRouter }; 