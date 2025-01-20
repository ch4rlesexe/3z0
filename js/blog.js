// Blog posts data
const blogPosts = [
    {
        id: 1,
        title: 'The Future of Web Development',
        category: 'Technology',
        image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643',
        excerpt: 'Exploring the latest trends and technologies shaping the web development landscape.',
        date: '2024-01-15'
    },
    {
        id: 2,
        title: 'Minimalist Design Principles',
        category: 'Design',
        image: 'https://images.unsplash.com/photo-1516542076529-1ea3854896f2',
        excerpt: 'Understanding the core principles of minimalist design and its impact.',
        date: '2024-01-12'
    },
    {
        id: 3,
        title: 'Mastering Time Management',
        category: 'Productivity',
        image: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e',
        excerpt: 'Essential strategies for better productivity and work-life balance.',
        date: '2024-01-10'
    },
    // Add more blog posts here
];

let currentPage = 1;
const postsPerPage = 6;

// Function to create blog post card
function createBlogPostCard(post) {
    return `
        <article class="post-card">
            <div class="post-image" style="background-image: url('${post.image}')"></div>
            <div class="post-content">
                <span class="category">${post.category}</span>
                <h3>${post.title}</h3>
                <p>${post.excerpt}</p>
                <div class="post-meta">
                    <span class="date">${new Date(post.date).toLocaleDateString()}</span>
                </div>
                <a href="/blogs/${post.id}.html" class="read-more">Read More</a>
            </div>
        </article>
    `;
}

// Function to load blog posts
function loadBlogPosts() {
    const blogGrid = document.querySelector('.blog-grid');
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const postsToShow = blogPosts.slice(startIndex, endIndex);

    const postsHTML = postsToShow.map(createBlogPostCard).join('');
    blogGrid.innerHTML += postsHTML;

    // Hide load more button if no more posts
    const loadMoreBtn = document.querySelector('.load-more');
    if (endIndex >= blogPosts.length) {
        loadMoreBtn.style.display = 'none';
    }
}

// Initialize blog page
document.addEventListener('DOMContentLoaded', () => {
    loadBlogPosts();

    // Load more posts button
    const loadMoreBtn = document.querySelector('.load-more');
    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        loadBlogPosts();
    });
});