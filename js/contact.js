document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());

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
//form validation, doesn't fully function but bones are here if you want it
        try {
            const submitBtn = contactForm.querySelector('.submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            await new Promise(resolve => setTimeout(resolve, 1500));

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

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}