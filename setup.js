#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 3Z0 Blog Platform Setup');
console.log('==========================\n');

async function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setup() {
    try {
        console.log('📋 Please provide the following information:\n');

        // Database configuration
        const dbHost = await question('Database Host (default: localhost): ') || 'localhost';
        const dbPort = await question('Database Port (default: 3306): ') || '3306';
        const dbUser = await question('Database User (default: root): ') || 'root';
        const dbPassword = await question('Database Password: ');
        const dbName = await question('Database Name (default: blog_db): ') || 'blog_db';

        // JWT and Session secrets
        const jwtSecret = await question('JWT Secret (press enter for auto-generate): ') || 
            Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const sessionSecret = await question('Session Secret (press enter for auto-generate): ') || 
            Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Email configuration
        const emailHost = await question('Email Host (default: smtp.gmail.com): ') || 'smtp.gmail.com';
        const emailPort = await question('Email Port (default: 587): ') || '587';
        const emailUser = await question('Email User: ');
        const emailPass = await question('Email Password (app password for Gmail): ');

        // Admin configuration
        const adminEmail = await question('Admin Email (default: admin@3z0.org): ') || 'admin@3z0.org';
        const adminPassword = await question('Admin Password (default: admin123): ') || 'admin123';

        // Server configuration
        const port = await question('Server Port (default: 3000): ') || '3000';

        // Create .env file
        const envContent = `# Database Configuration
DB_HOST=${dbHost}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DB_NAME=${dbName}
DB_PORT=${dbPort}

# JWT Secret
JWT_SECRET=${jwtSecret}

# Session Secret
SESSION_SECRET=${sessionSecret}

# Email Configuration (for password reset)
EMAIL_HOST=${emailHost}
EMAIL_PORT=${emailPort}
EMAIL_USER=${emailUser}
EMAIL_PASS=${emailPass}

# Server Configuration
PORT=${port}
NODE_ENV=development

# Admin Configuration
ADMIN_EMAIL=${adminEmail}
ADMIN_PASSWORD=${adminPassword}
`;

        fs.writeFileSync('.env', envContent);
        console.log('\n✅ .env file created successfully!');

        // Install dependencies
        console.log('\n📦 Installing dependencies...');
        const { execSync } = require('child_process');
        execSync('npm install', { stdio: 'inherit' });

        // Initialize database
        console.log('\n🗄️  Initializing database...');
        execSync('npm run init-db', { stdio: 'inherit' });

        console.log('\n🎉 Setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Start the server: npm run dev');
        console.log('2. Visit: http://localhost:' + port);
        console.log('3. Admin panel: http://localhost:' + port + '/admin');
        console.log('4. Default admin login:');
        console.log('   Email: ' + adminEmail);
        console.log('   Password: ' + adminPassword);
        console.log('\n⚠️  Important: Change the default admin password after first login!');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

setup(); 