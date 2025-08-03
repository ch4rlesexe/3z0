# 3Z0 Blog Platform

A modern, full-featured blog platform built with Node.js, Express, and MySQL. Features user authentication, post reactions, comments, admin panel, and a beautiful responsive design.

## 🌟 Features

### ✨ User Features
- **User Registration & Authentication** - Secure JWT-based authentication
- **Email Verification** - Email verification for new accounts
- **Password Reset** - Secure password reset via email
- **Post Reactions** - Like, love, laugh, wow, sad, angry reactions
- **Comments System** - Nested comments with approval system
- **User Profiles** - Customizable user profiles with avatars
- **Dark/Light Mode** - Beautiful theme switching

### 🛡️ Admin Features
- **Admin Dashboard** - Comprehensive analytics and statistics
- **Content Management** - Create, edit, and delete blog posts
- **User Management** - Manage users, roles, and permissions
- **Comment Moderation** - Approve/reject comments
- **Analytics** - Detailed insights and reports
- **Media Management** - Upload and manage images

### 📱 Technical Features
- **Responsive Design** - Mobile-first responsive design
- **SEO Optimized** - Meta tags, structured data, sitemap
- **Security** - Rate limiting, CORS, helmet, input validation
- **Performance** - Database connection pooling, optimized queries
- **Real-time Updates** - Live reaction and comment updates

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd www.3z0.org
npm install
```

### 2. Environment Setup
```bash
# Copy environment file
cp env.example .env

# Edit .env with your configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=blog_db
JWT_SECRET=your_super_secret_jwt_key_here
SESSION_SECRET=your_session_secret_here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 3. Database Setup
```bash
# Initialize database and create tables
npm run init-db
```

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see your blog!

## 📁 Project Structure

```
www.3z0.org/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── posts.js             # Blog post routes
│   └── admin.js             # Admin panel routes
├── scripts/
│   └── init-database.js     # Database initialization
├── uploads/                 # Image uploads directory
├── assets/                  # Static assets
├── styling/                 # HTML components
├── blogs/                   # Static blog posts
├── js/                      # Frontend JavaScript
├── server.js                # Main server file
├── package.json             # Dependencies
└── README.md               # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify/:token` - Email verification
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password/:token` - Password reset
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Blog Posts
- `GET /api/posts` - Get all published posts
- `GET /api/posts/:slug` - Get single post
- `POST /api/posts` - Create post (admin)
- `PUT /api/posts/:id` - Update post (admin)
- `DELETE /api/posts/:id` - Delete post (admin)
- `POST /api/posts/:id/reactions` - Add reaction
- `DELETE /api/posts/:id/reactions` - Remove reaction
- `POST /api/posts/:id/comments` - Add comment
- `GET /api/posts/categories/list` - Get categories

### Admin Panel
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/posts` - Manage posts
- `GET /api/admin/users` - Manage users
- `GET /api/admin/comments` - Manage comments
- `PUT /api/admin/comments/:id/approve` - Approve/reject comment
- `DELETE /api/admin/comments/:id` - Delete comment
- `PUT /api/admin/users/:id/role` - Update user role
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/analytics` - Analytics data

## 👤 Default Admin Account

After running the database initialization, you'll have a default admin account:

- **Email:** admin@3z0.org
- **Password:** admin123

**⚠️ Important:** Change the default password immediately after first login!

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt for password security
- **Rate Limiting** - Prevent brute force attacks
- **Input Validation** - Express-validator for data validation
- **CORS Protection** - Cross-origin resource sharing protection
- **Helmet Security** - Security headers
- **SQL Injection Protection** - Parameterized queries
- **XSS Protection** - Content Security Policy

## 📧 Email Configuration

For email functionality (verification, password reset), configure your email settings in `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

For Gmail, you'll need to:
1. Enable 2-factor authentication
2. Generate an app password
3. Use the app password in EMAIL_PASS

## 🎨 Customization

### Personal Links
The footer includes links to your personal website and social media:
- Personal Website: `ch4rlesexe.me`
- GitHub: `github.com/ch4rlesexe`
- Twitter: `twitter.com/ch4rlesexe`
- LinkedIn: `linkedin.com/in/ch4rlesexe`
- Instagram: `instagram.com/ch4rlesexe`
- YouTube: `youtube.com/@ch4rlesexe`

### Styling
- Main styles: `style.css`
- Dark mode: CSS variables in `:root` and `[data-theme="dark"]`
- Responsive design: Media queries for mobile optimization

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production` in `.env`
2. Configure production database
3. Set up SSL certificates
4. Configure reverse proxy (nginx)
5. Use PM2 for process management

### Environment Variables for Production
```env
NODE_ENV=production
DB_HOST=your_production_db_host
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
JWT_SECRET=your_very_secure_jwt_secret
SESSION_SECRET=your_very_secure_session_secret
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Charlie** - [ch4rlesexe.me](https://ch4rlesexe.me)

---

**Built with ❤️ using Node.js, Express, and MySQL**
