const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
    let connection;
    
    try {
        // Create connection without database first
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306
        });

        console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'blog_db'}`);
        console.log(`Database '${process.env.DB_NAME || 'blog_db'}' created or already exists`);

        // Use the database
        await connection.execute(`USE ${process.env.DB_NAME || 'blog_db'}`);

        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                first_name VARCHAR(50),
                last_name VARCHAR(50),
                display_name VARCHAR(100),
                profile_picture VARCHAR(255),
                banner_image VARCHAR(255),
                bio TEXT,
                social_links JSON,
                is_admin BOOLEAN DEFAULT FALSE,
                is_verified BOOLEAN DEFAULT FALSE,
                email_verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255),
                reset_token VARCHAR(255),
                reset_token_expires DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_banned BOOLEAN DEFAULT FALSE,
                is_deactivated BOOLEAN DEFAULT FALSE,
                deactivated_at TIMESTAMP NULL,
                ban_reason TEXT,
                deactivation_reason TEXT,
                registration_ip VARCHAR(45),
                user_agent TEXT,
                last_login_at DATETIME,
                login_count INT DEFAULT 0
            )
        `);
        console.log('Users table created');

        // Add missing columns to users table if they don't exist
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN display_name VARCHAR(100)`);
            console.log('Added display_name column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255)`);
            console.log('Added profile_picture column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN banner_image VARCHAR(255)`);
            console.log('Added banner_image column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN bio TEXT`);
            console.log('Added bio column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN social_links JSON`);
            console.log('Added social_links column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE`);
            console.log('Added email_verified column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE`);
            console.log('Added is_banned column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN is_deactivated BOOLEAN DEFAULT FALSE`);
            console.log('Added is_deactivated column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN ban_reason TEXT`);
            console.log('Added ban_reason column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN deactivation_reason TEXT`);
            console.log('Added deactivation_reason column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN registration_ip VARCHAR(45)`);
            console.log('Added registration_ip column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN user_agent TEXT`);
            console.log('Added user_agent column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN last_login_at DATETIME`);
            console.log('Added last_login_at column to users table');
        } catch (error) {
            // Column already exists
        }
        
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN login_count INT DEFAULT 0`);
            console.log('Added login_count column to users table');
        } catch (error) {
            // Column already exists
        }

        // Create posts table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                content TEXT NOT NULL,
                excerpt TEXT,
                featured_image VARCHAR(255),
                author_id INT NOT NULL,
                status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
                category VARCHAR(50) DEFAULT 'General',
                tags JSON,
                view_count INT DEFAULT 0,
                published_at DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Posts table created');

        // Create reactions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS reactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                reaction_type ENUM('like', 'love', 'laugh', 'wow', 'sad', 'angry') DEFAULT 'like',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_reaction (post_id, user_id, reaction_type)
            )
        `);
        console.log('Reactions table created');

        // Create comments table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                parent_id INT NULL,
                content TEXT NOT NULL,
                is_approved BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
            )
        `);
        console.log('Comments table created');

        // Create sessions table for session storage
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(128) PRIMARY KEY,
                expires INT NOT NULL,
                data TEXT
            )
        `);
        console.log('Sessions table created');

        // Create wall_messages table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS wall_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                author_id INT NOT NULL,
                message TEXT NOT NULL,
                is_approved BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Wall messages table created');

        // Create user_session_time table for tracking total time spent
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_session_time (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_id VARCHAR(255) NOT NULL,
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP NULL,
                duration_seconds INT DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('User session time table created');

        // Create roles table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                color VARCHAR(7) DEFAULT '#6B7280',
                is_system_role BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('Roles table created');

        // Create permissions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                category VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Permissions table created');

        // Create user_roles table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                role_id INT NOT NULL,
                assigned_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE KEY unique_user_role (user_id, role_id)
            )
        `);
        console.log('User roles table created');

        // Create role_permissions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role_id INT NOT NULL,
                permission_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                UNIQUE KEY unique_role_permission (role_id, permission_id)
            )
        `);
        console.log('Role permissions table created');

        // Insert default roles
        await connection.execute(`
            INSERT IGNORE INTO roles (name, description, color, is_system_role) VALUES
            ('admin', 'Full system administrator with all permissions', '#DC2626', TRUE),
            ('moderator', 'Can moderate content and manage users', '#059669', TRUE),
            ('contributor', 'Can create and edit posts, view analytics', '#2563EB', TRUE),
            ('staff', 'Can moderate comments and manage content', '#7C3AED', TRUE),
            ('user', 'Regular user with basic permissions', '#6B7280', TRUE)
        `);
        console.log('Default roles inserted');

        // Insert default permissions
        await connection.execute(`
            INSERT IGNORE INTO permissions (name, description, category) VALUES
            -- User Management
            ('users.view', 'View user profiles and information', 'user_management'),
            ('users.edit', 'Edit user information and settings', 'user_management'),
            ('users.delete', 'Delete user accounts', 'user_management'),
            ('users.ban', 'Ban and unban users', 'user_management'),
            ('users.verify', 'Verify user email addresses', 'user_management'),
            ('users.roles', 'Assign and manage user roles', 'user_management'),
            
            -- Post Management
            ('posts.view', 'View all posts including drafts', 'post_management'),
            ('posts.create', 'Create new posts', 'post_management'),
            ('posts.edit', 'Edit existing posts', 'post_management'),
            ('posts.delete', 'Delete posts', 'post_management'),
            ('posts.publish', 'Publish and unpublish posts', 'post_management'),
            ('posts.categories', 'Manage post categories', 'post_management'),
            
            -- Comment Management
            ('comments.view', 'View all comments including pending', 'comment_management'),
            ('comments.approve', 'Approve and reject comments', 'comment_management'),
            ('comments.edit', 'Edit user comments', 'comment_management'),
            ('comments.delete', 'Delete comments', 'comment_management'),
            
            -- Analytics
            ('analytics.view', 'View analytics and statistics', 'analytics'),
            ('analytics.export', 'Export analytics data', 'analytics'),
            
            -- System
            ('system.settings', 'Manage system settings', 'system'),
            ('system.backup', 'Create and manage backups', 'system'),
            ('system.logs', 'View system logs', 'system')
        `);
        console.log('Default permissions inserted');

        // Assign permissions to roles
        const rolePermissions = [
            // Admin - all permissions
            ['admin', 'users.view'], ['admin', 'users.edit'], ['admin', 'users.delete'], ['admin', 'users.ban'], 
            ['admin', 'users.verify'], ['admin', 'users.roles'], ['admin', 'posts.view'], ['admin', 'posts.create'],
            ['admin', 'posts.edit'], ['admin', 'posts.delete'], ['admin', 'posts.publish'], ['admin', 'posts.categories'],
            ['admin', 'comments.view'], ['admin', 'comments.approve'], ['admin', 'comments.edit'], ['admin', 'comments.delete'],
            ['admin', 'analytics.view'], ['admin', 'analytics.export'], ['admin', 'system.settings'], ['admin', 'system.backup'],
            ['admin', 'system.logs'],
            
            // Moderator
            ['moderator', 'users.view'], ['moderator', 'users.edit'], ['moderator', 'users.ban'], ['moderator', 'users.verify'],
            ['moderator', 'posts.view'], ['moderator', 'posts.edit'], ['moderator', 'posts.publish'],
            ['moderator', 'comments.view'], ['moderator', 'comments.approve'], ['moderator', 'comments.edit'], ['moderator', 'comments.delete'],
            ['moderator', 'analytics.view'],
            
            // Contributor
            ['contributor', 'posts.view'], ['contributor', 'posts.create'], ['contributor', 'posts.edit'],
            ['contributor', 'comments.view'], ['contributor', 'analytics.view'],
            
            // Staff
            ['staff', 'posts.view'], ['staff', 'comments.view'], ['staff', 'comments.approve'], ['staff', 'comments.edit'],
            ['staff', 'comments.delete'],
            
            // User - basic permissions
            ['user', 'posts.view']
        ];

        for (const [roleName, permissionName] of rolePermissions) {
            await connection.execute(`
                INSERT IGNORE INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r, permissions p
                WHERE r.name = ? AND p.name = ?
            `, [roleName, permissionName]);
        }
        console.log('Role permissions assigned');

        // Assign admin role to existing admin user
        await connection.execute(`
            INSERT IGNORE INTO user_roles (user_id, role_id)
            SELECT u.id, r.id FROM users u, roles r
            WHERE u.username = 'admin' AND r.name = 'admin'
        `);
        console.log('Admin role assigned to admin user');

        // Create analytics tracking tables
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS page_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                page_url VARCHAR(500) NOT NULL,
                user_id INT NULL,
                session_id VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                referrer VARCHAR(500),
                country VARCHAR(100),
                region VARCHAR(100),
                city VARCHAR(100),
                device_type ENUM('desktop', 'mobile', 'tablet') DEFAULT 'desktop',
                browser VARCHAR(100),
                os VARCHAR(100),
                view_duration INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('Page views table created');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                user_id INT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                country VARCHAR(100),
                region VARCHAR(100),
                city VARCHAR(100),
                device_type ENUM('desktop', 'mobile', 'tablet') DEFAULT 'desktop',
                browser VARCHAR(100),
                os VARCHAR(100),
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP NULL,
                duration INT DEFAULT 0,
                page_count INT DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('User sessions table created');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                session_id VARCHAR(255) NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                event_data JSON,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('User events table created');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS search_queries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                session_id VARCHAR(255) NOT NULL,
                query VARCHAR(500) NOT NULL,
                results_count INT DEFAULT 0,
                clicked_result BOOLEAN DEFAULT FALSE,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('Search queries table created');

        // Create admin user
        const adminPassword = require('bcryptjs').hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        await connection.execute(`
            INSERT IGNORE INTO users (username, email, password, first_name, last_name, display_name, bio, is_admin, is_verified, email_verified)
            VALUES (?, ?, ?, 'Admin', 'User', 'Admin User', ?, TRUE, TRUE, TRUE)
        `, ['admin', process.env.ADMIN_EMAIL || 'admin@3z0.org', adminPassword, 'Welcome to 3Z0 Blog! I\'m the admin here.']);
        console.log('Admin user created');

        // Insert sample posts
        const samplePosts = [
            {
                title: 'The Future of Web Development',
                slug: 'future-of-web-development',
                content: 'Web development is evolving rapidly with new technologies and frameworks emerging constantly...',
                excerpt: 'Exploring the latest trends and technologies shaping the web development landscape.',
                author_id: 1,
                status: 'published',
                category: 'Technology',
                tags: JSON.stringify(['web development', 'technology', 'trends'])
            },
            {
                title: 'Minimalist Design Principles',
                slug: 'minimalist-design-principles',
                content: 'Minimalist design is not just about simplicity; it\'s about clarity, functionality, and aesthetics...',
                excerpt: 'Understanding the core principles of minimalist design and its impact.',
                author_id: 1,
                status: 'published',
                category: 'Design',
                tags: JSON.stringify(['design', 'minimalism', 'ux'])
            },
            {
                title: 'Mastering Time Management',
                slug: 'mastering-time-management',
                content: 'Time management is an essential skill that impacts productivity, efficiency, and overall success...',
                excerpt: 'Learn effective strategies to manage your time and boost productivity.',
                author_id: 1,
                status: 'published',
                category: 'Productivity',
                tags: JSON.stringify(['productivity', 'time management', 'habits'])
            }
        ];

        for (const post of samplePosts) {
            await connection.execute(`
                INSERT IGNORE INTO posts (title, slug, content, excerpt, author_id, status, category, tags, published_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [post.title, post.slug, post.content, post.excerpt, post.author_id, post.status, post.category, post.tags]);
        }
        console.log('Sample posts created');

        console.log('Database initialization completed successfully!');
        
    } catch (error) {
        console.error('Error initializing database:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

initializeDatabase(); 