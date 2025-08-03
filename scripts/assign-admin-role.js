const mysql = require('mysql2/promise');
require('dotenv').config();

async function assignAdminRole() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
            database: process.env.DB_NAME || 'blog_db'
        });

        console.log('Connected to database');

        // Get admin user ID
        const [adminUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            ['admin', 'admin@3z0.org']
        );

        if (adminUsers.length === 0) {
            console.log('Admin user not found. Please create an admin user first.');
            return;
        }

        const adminUserId = adminUsers[0].id;

        // Get admin role ID
        const [adminRoles] = await connection.execute(
            'SELECT id FROM roles WHERE name = ?',
            ['admin']
        );

        if (adminRoles.length === 0) {
            console.log('Admin role not found. Please run the database initialization first.');
            return;
        }

        const adminRoleId = adminRoles[0].id;

        // Check if admin role is already assigned
        const [existingRoles] = await connection.execute(
            'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
            [adminUserId, adminRoleId]
        );

        if (existingRoles.length > 0) {
            console.log('Admin role is already assigned to admin user.');
            return;
        }

        // Assign admin role to admin user
        await connection.execute(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [adminUserId, adminRoleId]
        );

        console.log('Admin role assigned successfully to admin user!');

    } catch (error) {
        console.error('Error assigning admin role:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

assignAdminRole(); 