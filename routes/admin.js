const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Check if user has admin role
router.get('/check-admin', authenticateToken, async (req, res) => {
    try {
        const [userRoles] = await pool.execute(`
            SELECT r.name 
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = ?
        `, [req.user.id]);
        
        const isAdmin = userRoles.some(role => role.name === 'admin');
        res.json({ isAdmin });
    } catch (error) {
        console.error('Check admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Apply admin middleware to all other routes
router.use(authenticateToken, requireAdmin);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        // Get total posts
        const [postStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_posts,
                COUNT(CASE WHEN status = 'published' THEN 1 END) as published_posts,
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_posts,
                SUM(view_count) as total_views
            FROM posts
        `);

        // Get total users
        const [userStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified_users,
                COUNT(CASE WHEN is_admin = TRUE THEN 1 END) as admin_users
            FROM users
        `);

        // Get total reactions and comments
        const [engagementStats] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM reactions) as total_reactions,
                (SELECT COUNT(*) FROM comments WHERE is_approved = TRUE) as total_comments
        `);

        // Get recent posts
        const [recentPosts] = await pool.execute(`
            SELECT 
                p.id, p.title, p.status, p.created_at, p.view_count,
                u.username as author
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 5
        `);

        // Get recent comments
        const [recentComments] = await pool.execute(`
            SELECT 
                c.id, c.content, c.created_at, c.is_approved,
                u.username as author,
                p.title as post_title
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN posts p ON c.post_id = p.id
            ORDER BY c.created_at DESC
            LIMIT 5
        `);

        res.json({
            stats: {
                posts: postStats[0],
                users: userStats[0],
                engagement: engagementStats[0]
            },
            recentPosts,
            recentComments
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all posts (admin view)
router.get('/posts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        const category = req.query.category;
        const search = req.query.search;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (status) {
            whereClause += ' AND p.status = ?';
            params.push(status);
        }

        if (category) {
            whereClause += ' AND p.category = ?';
            params.push(category);
        }

        if (search) {
            whereClause += ' AND (p.title LIKE ? OR p.content LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        // Get posts with author info
        const [posts] = await pool.execute(`
            SELECT 
                p.*,
                u.username as author_username,
                u.first_name as author_first_name,
                u.last_name as author_last_name,
                COUNT(DISTINCT r.id) as reaction_count,
                COUNT(DISTINCT c.id) as comment_count
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN reactions r ON p.id = r.post_id
            LEFT JOIN comments c ON p.id = c.post_id
            ${whereClause}
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        // Get total count
        const [countResult] = await pool.execute(`
            SELECT COUNT(*) as total
            FROM posts p
            ${whereClause}
        `, params);

        const totalPosts = countResult[0].total;
        const totalPages = Math.ceil(totalPosts / limit);

        res.json({
            posts,
            pagination: {
                currentPage: page,
                totalPages,
                totalPosts,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get admin posts error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all users (admin view)
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (search) {
            whereClause += ' AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Get users with post counts
        const [users] = await pool.execute(`
            SELECT 
                u.*,
                COUNT(p.id) as post_count
            FROM users u
            LEFT JOIN posts p ON u.id = p.author_id
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        // Get total count
        const [countResult] = await pool.execute(`
            SELECT COUNT(*) as total
            FROM users u
            ${whereClause}
        `, params);

        const totalUsers = countResult[0].total;
        const totalPages = Math.ceil(totalUsers / limit);

        // Remove passwords from response
        users.forEach(user => {
            delete user.password;
        });

        res.json({
            users,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all comments (admin view)
router.get('/comments', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status; // approved, pending

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (status === 'approved') {
            whereClause += ' AND c.is_approved = TRUE';
        } else if (status === 'pending') {
            whereClause += ' AND c.is_approved = FALSE';
        }

        // Get comments with user and post info
        const [comments] = await pool.execute(`
            SELECT 
                c.*,
                u.username,
                u.first_name,
                u.last_name,
                p.title as post_title,
                p.slug as post_slug
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN posts p ON c.post_id = p.id
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        // Get total count
        const [countResult] = await pool.execute(`
            SELECT COUNT(*) as total
            FROM comments c
            ${whereClause}
        `, params);

        const totalComments = countResult[0].total;
        const totalPages = Math.ceil(totalComments / limit);

        res.json({
            comments,
            pagination: {
                currentPage: page,
                totalPages,
                totalComments,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Approve/Reject comment
router.put('/comments/:id/approve', [
    body('isApproved').isBoolean().withMessage('isApproved must be a boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { isApproved } = req.body;

        const [result] = await pool.execute(
            'UPDATE comments SET is_approved = ? WHERE id = ?',
            [isApproved, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        res.json({ message: `Comment ${isApproved ? 'approved' : 'rejected'} successfully` });

    } catch (error) {
        console.error('Approve comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete comment
router.delete('/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.execute(
            'DELETE FROM comments WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        res.json({ message: 'Comment deleted successfully' });

    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user role
router.put('/users/:id/role', [
    body('isAdmin').isBoolean().withMessage('isAdmin must be a boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { isAdmin } = req.body;

        // Prevent admin from removing their own admin status
        if (parseInt(id) === req.user.id && !isAdmin) {
            return res.status(400).json({ message: 'Cannot remove your own admin status' });
        }

        const [result] = await pool.execute(
            'UPDATE users SET is_admin = ? WHERE id = ?',
            [isAdmin, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: `User ${isAdmin ? 'promoted to admin' : 'removed from admin'} successfully` });

    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Deactivate user account (instead of delete)
router.patch('/users/:id/deactivate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        // Deactivate user account
        await pool.execute(`
            UPDATE users 
            SET is_deactivated = TRUE, 
                deactivated_at = NOW(), 
                deactivation_reason = ?
            WHERE id = ?
        `, [reason || 'Account deactivated by admin', id]);
        
        res.json({ message: 'User account deactivated successfully' });
    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reactivate user account
router.patch('/users/:id/reactivate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        // Reactivate user account
        await pool.execute(`
            UPDATE users 
            SET is_deactivated = FALSE, 
                deactivated_at = NULL, 
                deactivation_reason = NULL
            WHERE id = ?
        `, [id]);
        
        res.json({ message: 'User account reactivated successfully' });
    } catch (error) {
        console.error('Reactivate user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user information (admin can edit all fields)
router.put('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            username, email, first_name, last_name, display_name, bio,
            website, location, social_links, is_banned, ban_reason,
            is_deactivated, deactivation_reason
        } = req.body;
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        // Check if username is already taken (if changing username)
        if (username) {
            const [existingUser] = await pool.execute(
                'SELECT id FROM users WHERE username = ? AND id != ?',
                [username, id]
            );
            
            if (existingUser.length > 0) {
                return res.status(400).json({ message: 'Username already taken' });
            }
        }
        
        // Check if email is already taken (if changing email)
        if (email) {
            const [existingUser] = await pool.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );
            
            if (existingUser.length > 0) {
                return res.status(400).json({ message: 'Email already taken' });
            }
        }
        
        // Update user information
        await pool.execute(`
            UPDATE users SET
                username = COALESCE(?, username),
                email = COALESCE(?, email),
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                display_name = COALESCE(?, display_name),
                bio = COALESCE(?, bio),
                website = COALESCE(?, website),
                location = COALESCE(?, location),
                social_links = COALESCE(?, social_links),
                is_banned = COALESCE(?, is_banned),
                ban_reason = COALESCE(?, ban_reason),
                is_deactivated = COALESCE(?, is_deactivated),
                deactivation_reason = COALESCE(?, deactivation_reason),
                updated_at = NOW()
            WHERE id = ?
        `, [
            username, email, first_name, last_name, display_name, bio,
            website, location, social_links ? JSON.stringify(social_links) : null,
            is_banned, ban_reason, is_deactivated, deactivation_reason, id
        ]);
        
        res.json({ message: 'User information updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user session time analytics
router.get('/users/:id/session-time', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        const [sessionData] = await pool.execute(`
            SELECT 
                DATE(start_time) as date,
                SUM(TIMESTAMPDIFF(MINUTE, start_time, 
                    CASE 
                        WHEN end_time IS NOT NULL THEN end_time 
                        ELSE NOW() 
                    END
                )) as total_minutes,
                COUNT(*) as session_count
            FROM user_session_time 
            WHERE user_id = ?
            GROUP BY DATE(start_time)
            ORDER BY date DESC
            LIMIT 30
        `, [userId]);
        
        res.json({ sessionData });
    } catch (error) {
        console.error('Error fetching user session time:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get analytics data
router.get('/analytics', async (req, res) => {
    try {
        const period = req.query.period || '30'; // days

        // Get posts created in the last X days
        const [postsData] = await pool.execute(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM posts
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [period]);

        // Get user registrations in the last X days
        const [usersData] = await pool.execute(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM users
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [period]);

        // Get top posts by views
        const [topPosts] = await pool.execute(`
            SELECT 
                p.title,
                p.slug,
                p.view_count,
                u.username as author
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.status = 'published'
            ORDER BY p.view_count DESC
            LIMIT 10
        `);

        // Get top categories
        const [topCategories] = await pool.execute(`
            SELECT 
                category,
                COUNT(*) as post_count,
                SUM(view_count) as total_views
            FROM posts
            WHERE status = 'published'
            GROUP BY category
            ORDER BY total_views DESC
            LIMIT 10
        `);

        // Get recent activity (posts, comments, user registrations)
        const [recentActivity] = await pool.execute(`
            SELECT 
                'post' as type,
                p.title as title,
                p.created_at as date,
                u.username as user
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            
            UNION ALL
            
            SELECT 
                'comment' as type,
                CONCAT('Comment on: ', p.title) as title,
                c.created_at as date,
                u.username as user
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN posts p ON c.post_id = p.id
            WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            
            UNION ALL
            
            SELECT 
                'user' as type,
                CONCAT(u.first_name, ' ', u.last_name, ' joined') as title,
                u.created_at as date,
                u.username as user
            FROM users u
            WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            
            ORDER BY date DESC
            LIMIT 20
        `);

        res.json({
            postsData,
            usersData,
            topPosts,
            topCategories,
            recentActivity
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single user details
router.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.execute(`
            SELECT 
                id, username, email, first_name, last_name, display_name,
                bio, profile_picture, banner_image, social_links,
                is_admin, is_verified, email_verified, created_at,
                last_login_at, registration_ip, is_banned, is_deactivated
            FROM users
            WHERE id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        
        // Parse social links if they exist
        if (user.social_links) {
            try {
                user.social_links = JSON.parse(user.social_links);
            } catch (e) {
                user.social_links = {};
            }
        }

        res.json(user);

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user status (ban/deactivate)
router.put('/users/:id/status', [
    body('action').isIn(['ban', 'unban', 'deactivate', 'activate']).withMessage('Invalid action'),
    body('reason').optional().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { action, reason } = req.body;

        let updateFields = {};
        let updateValues = [];

        switch (action) {
            case 'ban':
                updateFields.is_banned = true;
                updateFields.ban_reason = reason;
                break;
            case 'unban':
                updateFields.is_banned = false;
                updateFields.ban_reason = null;
                break;
            case 'deactivate':
                updateFields.is_deactivated = true;
                updateFields.deactivation_reason = reason;
                break;
            case 'activate':
                updateFields.is_deactivated = false;
                updateFields.deactivation_reason = null;
                break;
        }

        const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        updateValues = [...Object.values(updateFields), id];

        await pool.execute(`
            UPDATE users 
            SET ${setClause}
            WHERE id = ?
        `, updateValues);

        res.json({ message: `User ${action}ed successfully` });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user registration info
router.get('/users/:id/registration', async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.execute(`
            SELECT 
                id, username, email, first_name, last_name,
                created_at, registration_ip, user_agent,
                is_verified, email_verified, verification_token,
                last_login_at, login_count
            FROM users
            WHERE id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(users[0]);

    } catch (error) {
        console.error('Get user registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user verification status
router.patch('/users/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_verified } = req.body;

        await pool.execute(
            'UPDATE users SET is_verified = ?, email_verified = ? WHERE id = ?',
            [is_verified, is_verified, id]
        );

        res.json({ message: 'User verification status updated successfully' });
    } catch (error) {
        console.error('Update user verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all roles
router.get('/roles', async (req, res) => {
    try {
        const [roles] = await pool.execute(`
            SELECT 
                r.*,
                COUNT(ur.user_id) as user_count,
                COUNT(rp.permission_id) as permission_count
            FROM roles r
            LEFT JOIN user_roles ur ON r.id = ur.role_id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            GROUP BY r.id
            ORDER BY r.is_system_role DESC, r.name
        `);

        res.json({ roles });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new role
router.post('/roles', [
    body('name').notEmpty().withMessage('Role name is required'),
    body('description').optional(),
    body('color').optional().isHexColor().withMessage('Invalid color format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, color = '#6B7280' } = req.body;

        // Check if role name already exists
        const [existing] = await pool.execute(
            'SELECT id FROM roles WHERE name = ?',
            [name]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Role name already exists' });
        }

        const [result] = await pool.execute(
            'INSERT INTO roles (name, description, color) VALUES (?, ?, ?)',
            [name, description, color]
        );

        res.status(201).json({ 
            message: 'Role created successfully',
            roleId: result.insertId
        });
    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update role
router.put('/roles/:id', [
    body('name').notEmpty().withMessage('Role name is required'),
    body('description').optional(),
    body('color').optional().isHexColor().withMessage('Invalid color format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, description, color } = req.body;

        // Check if role exists and is not a system role
        const [roles] = await pool.execute(
            'SELECT * FROM roles WHERE id = ?',
            [id]
        );

        if (roles.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (roles[0].is_system_role) {
            return res.status(400).json({ message: 'Cannot modify system roles' });
        }

        // Check if new name conflicts with existing role
        const [existing] = await pool.execute(
            'SELECT id FROM roles WHERE name = ? AND id != ?',
            [name, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Role name already exists' });
        }

        await pool.execute(
            'UPDATE roles SET name = ?, description = ?, color = ? WHERE id = ?',
            [name, description, color, id]
        );

        res.json({ message: 'Role updated successfully' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete role
router.delete('/roles/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if role exists and is not a system role
        const [roles] = await pool.execute(
            'SELECT * FROM roles WHERE id = ?',
            [id]
        );

        if (roles.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (roles[0].is_system_role) {
            return res.status(400).json({ message: 'Cannot delete system roles' });
        }

        // Check if role is assigned to any users
        const [userRoles] = await pool.execute(
            'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
            [id]
        );

        if (userRoles[0].count > 0) {
            return res.status(400).json({ message: 'Cannot delete role that is assigned to users' });
        }

        await pool.execute('DELETE FROM roles WHERE id = ?', [id]);

        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get role by ID
router.get('/roles/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const roleId = req.params.id;
        
        // Get role details
        const [roles] = await pool.execute('SELECT * FROM roles WHERE id = ?', [roleId]);
        
        if (roles.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }
        
        const role = roles[0];
        
        // Get role permissions
        const [permissions] = await pool.execute(`
            SELECT p.*, CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 0 END as has_permission
            FROM permissions p
            LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ?
            ORDER BY p.category, p.name
        `, [roleId]);
        
        res.json({ role, permissions });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all permissions
router.get('/permissions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [permissions] = await pool.execute(`
            SELECT * FROM permissions 
            ORDER BY category, name
        `);
        
        res.json({ permissions });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get role permissions
router.get('/roles/:id/permissions', async (req, res) => {
    try {
        const { id } = req.params;

        const [permissions] = await pool.execute(`
            SELECT p.*, rp.role_id IS NOT NULL as has_permission
            FROM permissions p
            LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ?
            ORDER BY p.category, p.name
        `, [id]);

        res.json({ permissions });
    } catch (error) {
        console.error('Get role permissions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update role permissions
router.put('/roles/:id/permissions', [
    body('permissions').isArray().withMessage('Permissions must be an array')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { permissions } = req.body;

        // Check if role exists
        const [roles] = await pool.execute(
            'SELECT * FROM roles WHERE id = ?',
            [id]
        );

        if (roles.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        // Remove all existing permissions for this role
        await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);

        // Add new permissions
        if (permissions.length > 0) {
            const values = permissions.map(permissionId => [id, permissionId]);
            await pool.execute(
                'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
                [values]
            );
        }

        res.json({ message: 'Role permissions updated successfully' });
    } catch (error) {
        console.error('Update role permissions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user roles
router.get('/users/:id/roles', async (req, res) => {
    try {
        const { id } = req.params;

        const [userRoles] = await pool.execute(`
            SELECT r.*, ur.assigned_by, u.username as assigned_by_username
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            LEFT JOIN users u ON ur.assigned_by = u.id
            WHERE ur.user_id = ?
            ORDER BY r.is_system_role DESC, r.name
        `, [id]);

        const [allRoles] = await pool.execute(`
            SELECT r.*, ur.user_id IS NOT NULL as has_role
            FROM roles r
            LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.user_id = ?
            ORDER BY r.is_system_role DESC, r.name
        `, [id]);

        res.json({ userRoles, allRoles });
    } catch (error) {
        console.error('Get user roles error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign role to user
router.post('/users/:id/roles', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { roleId } = req.body;
        
        // Check if user already has this role
        const [existing] = await pool.execute(
            'SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?',
            [userId, roleId]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already has this role' });
        }
        
        // Add role to user
        await pool.execute(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [userId, roleId]
        );
        
        res.status(201).json({ message: 'Role added successfully' });
    } catch (error) {
        console.error('Error adding role to user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove role from user
router.delete('/users/:id/roles/:roleId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const roleId = req.params.roleId;
        
        await pool.execute(
            'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
            [userId, roleId]
        );
        
        res.json({ message: 'Role removed successfully' });
    } catch (error) {
        console.error('Error removing role from user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 