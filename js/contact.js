document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form data
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());

        // Simple form validation
        let isValid = true;
        const errors = [];

        if (!data.name.trim()) {
            isValid = false;
            errors.push('Name is required');
        }

        if (!data.email.trim()) {
            isValid = false;
            errors.push('Email is required');
        } else if (!isValidEmail(data.email)) {
            isValid = false;
            errors.push('Please enter a valid email address');
        }

        if (!data.message.trim()) {
            isValid = false;
            errors.push('Message is required');
        }

        if (!isValid) {
            alert(errors.join('\n'));
            return;
        }

        // Simulate form submission
        try {
            const submitBtn = contactForm.querySelector('.submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Success message
            alert('Thank you for your message! We will get back to you soon.');
            contactForm.reset();
        } catch (error) {
            alert('An error occurred. Please try again later.');
        } finally {
            const submitBtn = contactForm.querySelector('.submit-btn');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Message';
        }
    });
});

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}