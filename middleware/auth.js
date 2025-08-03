const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const [users] = await pool.execute(
            'SELECT id, username, email, first_name, last_name, is_admin, is_verified FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = users[0];
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Middleware to check if user is verified
const requireVerified = (req, res, next) => {
    if (!req.user || !req.user.is_verified) {
        return res.status(403).json({ message: 'Email verification required' });
    }
    next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [users] = await pool.execute(
                'SELECT id, username, email, first_name, last_name, is_admin, is_verified FROM users WHERE id = ?',
                [decoded.userId]
            );

            if (users.length > 0) {
                req.user = users[0];
            }
        } catch (error) {
            // Token is invalid, but we don't fail the request
        }
    }
    next();
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireVerified,
    optionalAuth
}; 