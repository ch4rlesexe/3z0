const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get current user's profile (for account settings)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(`
            SELECT 
                id, username, email, first_name, last_name, display_name,
                profile_picture, banner_image, bio, website, location, social_links,
                created_at, updated_at
            FROM users 
            WHERE id = ?
        `, [req.user.id]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // Parse social links JSON
        let socialLinks = {};
        if (user.social_links) {
            try {
                socialLinks = JSON.parse(user.social_links);
            } catch (e) {
                socialLinks = {};
            }
        }

        res.json({
            ...user,
            social_links: socialLinks
        });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user profile by username
router.get('/:username/profile', async (req, res) => {
    try {
        const { username } = req.params;

        // Get user data with counts
        const [users] = await pool.execute(`
            SELECT 
                u.*,
                COUNT(DISTINCT p.id) as posts_count,
                COUNT(DISTINCT w.id) as wall_messages_count
            FROM users u
            LEFT JOIN posts p ON u.id = p.author_id AND p.status = 'published'
            LEFT JOIN wall_messages w ON u.id = w.user_id
            WHERE u.username = ?
            GROUP BY u.id
        `, [username]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // Parse social links JSON
        let socialLinks = {};
        if (user.social_links) {
            try {
                socialLinks = JSON.parse(user.social_links);
            } catch (e) {
                socialLinks = {};
            }
        }

        // Remove sensitive data
        delete user.password;
        delete user.email_verified;
        delete user.reset_token;
        delete user.reset_token_expires;

        res.json({
            user: {
                ...user,
                social_links: socialLinks
            }
        });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's wall messages
router.get('/:username/wall', optionalAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user ID
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userId = users[0].id;
        
        // Get wall messages
        const [messages] = await pool.execute(`
            SELECT 
                wm.id,
                wm.message as content,
                wm.created_at,
                u.display_name as author_name,
                u.profile_picture as author_avatar
            FROM wall_messages wm
            JOIN users u ON wm.author_id = u.id
            WHERE wm.user_id = ?
            ORDER BY wm.created_at DESC
        `, [userId]);
        
        res.json({ messages });
    } catch (error) {
        console.error('Error fetching wall messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Post message on user's wall
router.post('/:username/wall', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const { content } = req.body;
        const authorId = req.user.id;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Message content is required' });
        }
        
        if (content.length > 500) {
            return res.status(400).json({ message: 'Message too long (max 500 characters)' });
        }
        
        // Get user ID
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userId = users[0].id;
        
        // Insert wall message
        await pool.execute(`
            INSERT INTO wall_messages (user_id, author_id, message)
            VALUES (?, ?, ?)
        `, [userId, authorId, content.trim()]);
        
        res.status(201).json({ message: 'Message posted successfully' });
    } catch (error) {
        console.error('Error posting wall message:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's posts
router.get('/:username/posts', optionalAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user ID
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userId = users[0].id;
        
        // Get user's posts
        const [posts] = await pool.execute(`
            SELECT 
                id,
                title,
                excerpt,
                created_at,
                updated_at
            FROM posts
            WHERE author_id = ?
            ORDER BY created_at DESC
        `, [userId]);
        
        res.json({ posts });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a wall message (only by the author or wall owner)
router.delete('/:username/wall/:messageId', authenticateToken, async (req, res) => {
    try {
        const { username, messageId } = req.params;
        const currentUserId = req.user.id;

        // Get user ID
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userId = users[0].id;

        // Get wall message
        const [messages] = await pool.execute(
            'SELECT * FROM wall_messages WHERE id = ? AND user_id = ?',
            [messageId, userId]
        );

        if (messages.length === 0) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const wallMessage = messages[0];

        // Check if user can delete (author or wall owner)
        if (wallMessage.author_id !== currentUserId && userId !== currentUserId) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        // Delete message
        await pool.execute(
            'DELETE FROM wall_messages WHERE id = ?',
            [messageId]
        );

        res.json({ message: 'Message deleted successfully' });

    } catch (error) {
        console.error('Delete wall message error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 