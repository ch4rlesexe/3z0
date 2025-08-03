const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Create a flexible upload middleware that accepts multiple field names
const flexibleUpload = (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        // Map any uploaded file to featured_image field
        if (req.files && req.files.length > 0) {
            req.file = req.files[0];
        }
        next();
    });
};

// Get all published posts (public)
router.get('/', optionalAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const category = req.query.category;
        const search = req.query.search;

        let whereClause = 'WHERE p.status = "published"';
        let params = [];

        if (category) {
            whereClause += ' AND p.category = ?';
            params.push(category);
        }

        if (search) {
            whereClause += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Get posts with author info and reaction counts
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
            LEFT JOIN comments c ON p.id = c.post_id AND c.is_approved = TRUE
            ${whereClause}
            GROUP BY p.id
            ORDER BY p.published_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        // Get total count for pagination
        const [countResult] = await pool.execute(`
            SELECT COUNT(*) as total
            FROM posts p
            ${whereClause}
        `, params);

        const totalPosts = countResult[0].total;
        const totalPages = Math.ceil(totalPosts / limit);

        // Get user reactions if authenticated
        let userReactions = {};
        if (req.user) {
            const postIds = posts.map(post => post.id);
            if (postIds.length > 0) {
                const [reactions] = await pool.execute(`
                    SELECT post_id, reaction_type
                    FROM reactions
                    WHERE user_id = ? AND post_id IN (${postIds.map(() => '?').join(',')})
                `, [req.user.id, ...postIds]);

                reactions.forEach(reaction => {
                    userReactions[reaction.post_id] = reaction.reaction_type;
                });
            }
        }

        // Add user reactions to posts
        posts.forEach(post => {
            post.user_reaction = userReactions[post.id] || null;
        });

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
        console.error('Get posts error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single post by ID (admin only)
router.get('/id/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const [posts] = await pool.execute(`
            SELECT 
                p.*,
                u.username as author_username,
                u.first_name as author_first_name,
                u.last_name as author_last_name
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.id = ?
        `, [id]);

        if (posts.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = posts[0];
        
        // Parse tags if they exist
        if (post.tags) {
            try {
                post.tags = JSON.parse(post.tags);
            } catch (e) {
                post.tags = [];
            }
        }

        res.json(post);

    } catch (error) {
        console.error('Get post by ID error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single post (public)
router.get('/:slug', optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;

        // Get post with author info
        const [posts] = await pool.execute(`
            SELECT 
                p.*,
                u.username as author_username,
                u.first_name as author_first_name,
                u.last_name as author_last_name,
                u.bio as author_bio,
                COUNT(DISTINCT r.id) as reaction_count,
                COUNT(DISTINCT c.id) as comment_count
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN reactions r ON p.id = r.post_id
            LEFT JOIN comments c ON p.id = c.post_id AND c.is_approved = TRUE
            WHERE p.slug = ? AND p.status = "published"
            GROUP BY p.id
        `, [slug]);

        if (posts.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = posts[0];

        // Increment view count
        await pool.execute(
            'UPDATE posts SET view_count = view_count + 1 WHERE id = ?',
            [post.id]
        );

        // Get comments
        const [comments] = await pool.execute(`
            SELECT 
                c.*,
                u.username,
                u.first_name,
                u.last_name,
                u.avatar
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ? AND c.is_approved = TRUE
            ORDER BY c.created_at ASC
        `, [post.id]);

        // Get user reaction if authenticated
        let userReaction = null;
        if (req.user) {
            const [reactions] = await pool.execute(
                'SELECT reaction_type FROM reactions WHERE user_id = ? AND post_id = ?',
                [req.user.id, post.id]
            );
            if (reactions.length > 0) {
                userReaction = reactions[0].reaction_type;
            }
        }

        // Get related posts
        const [relatedPosts] = await pool.execute(`
            SELECT id, title, slug, excerpt, featured_image, published_at
            FROM posts
            WHERE status = "published" 
            AND category = ? 
            AND id != ?
            ORDER BY published_at DESC
            LIMIT 3
        `, [post.category, post.id]);

        post.user_reaction = userReaction;
        post.comments = comments;
        post.related_posts = relatedPosts;

        res.json({ post });

    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create post (admin only)
router.post('/', authenticateToken, requireAdmin, flexibleUpload, [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('excerpt').optional().isLength({ max: 300 }).withMessage('Excerpt must be less than 300 characters'),
    body('category').notEmpty().withMessage('Category is required'),
    body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, content, excerpt, category, tags, status = 'draft' } = req.body;
        
        // Generate slug from title
        const slug = title.toLowerCase()
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');

        const featuredImage = req.file ? `/uploads/${req.file.filename}` : null;

        const [result] = await pool.execute(`
            INSERT INTO posts (title, slug, content, excerpt, featured_image, author_id, status, category, tags, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            title, 
            slug, 
            content, 
            excerpt, 
            featuredImage, 
            req.user.id, 
            status, 
            category, 
            JSON.stringify(tags || []),
            status === 'published' ? new Date() : null
        ]);

        res.status(201).json({ 
            message: 'Post created successfully',
            postId: result.insertId,
            slug
        });

    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update post (admin only)
router.put('/:id', authenticateToken, requireAdmin, flexibleUpload, [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('excerpt').optional().isLength({ max: 300 }).withMessage('Excerpt must be less than 300 characters'),
    body('category').notEmpty().withMessage('Category is required'),
    body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { title, content, excerpt, category, tags, status } = req.body;

        // Check if post exists
        const [posts] = await pool.execute(
            'SELECT * FROM posts WHERE id = ?',
            [id]
        );

        if (posts.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = posts[0];

        // Generate new slug if title changed
        let slug = post.slug;
        if (title !== post.title) {
            slug = title.toLowerCase()
                .replace(/[^a-z0-9 -]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim('-');
        }

        const featuredImage = req.file ? `/uploads/${req.file.filename}` : post.featured_image;

        // Update post
        await pool.execute(`
            UPDATE posts 
            SET title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, 
                status = ?, category = ?, tags = ?, published_at = ?
            WHERE id = ?
        `, [
            title, 
            slug, 
            content, 
            excerpt, 
            featuredImage, 
            status, 
            category, 
            JSON.stringify(tags || []),
            status === 'published' && !post.published_at ? new Date() : post.published_at,
            id
        ]);

        res.json({ message: 'Post updated successfully' });

    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete post (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.execute(
            'DELETE FROM posts WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        res.json({ message: 'Post deleted successfully' });

    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add reaction to post
router.post('/:id/reactions', authenticateToken, [
    body('reactionType').isIn(['like', 'love', 'laugh', 'wow', 'sad', 'angry']).withMessage('Invalid reaction type')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { reactionType } = req.body;

        // Check if post exists
        const [posts] = await pool.execute(
            'SELECT id FROM posts WHERE id = ? AND status = "published"',
            [id]
        );

        if (posts.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Remove existing reaction from this user
        await pool.execute(
            'DELETE FROM reactions WHERE user_id = ? AND post_id = ?',
            [req.user.id, id]
        );

        // Add new reaction
        await pool.execute(
            'INSERT INTO reactions (user_id, post_id, reaction_type) VALUES (?, ?, ?)',
            [req.user.id, id, reactionType]
        );

        res.json({ message: 'Reaction added successfully' });

    } catch (error) {
        console.error('Add reaction error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove reaction from post
router.delete('/:id/reactions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.execute(
            'DELETE FROM reactions WHERE user_id = ? AND post_id = ?',
            [req.user.id, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Reaction not found' });
        }

        res.json({ message: 'Reaction removed successfully' });

    } catch (error) {
        console.error('Remove reaction error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add comment to post
router.post('/:id/comments', authenticateToken, [
    body('content').notEmpty().withMessage('Comment content is required').isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { content, parentId } = req.body;

        // Check if post exists
        const [posts] = await pool.execute(
            'SELECT id FROM posts WHERE id = ? AND status = "published"',
            [id]
        );

        if (posts.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Add comment
        const [result] = await pool.execute(
            'INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
            [id, req.user.id, parentId || null, content]
        );

        res.status(201).json({ 
            message: 'Comment added successfully',
            commentId: result.insertId
        });

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get categories
router.get('/categories/list', async (req, res) => {
    try {
        const [categories] = await pool.execute(`
            SELECT category, COUNT(*) as post_count
            FROM posts
            WHERE status = "published"
            GROUP BY category
            ORDER BY post_count DESC
        `);

        res.json({ categories });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 