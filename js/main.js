// ===== Navbar Scroll Effect =====
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// ===== Mobile Navigation Toggle =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('active');
  navToggle.classList.toggle('active');
});

// Close mobile nav when clicking a link
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('active');
    navToggle.classList.remove('active');
  });
});

// ===== Smooth Scroll for Navigation Links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ===== Scroll Animations =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Add fade-in class to elements and observe them
function initAnimations() {
  const animateElements = document.querySelectorAll(
    '.step-card, .testimonial-card, .contact-item, .feature-card, .feature-row, .mockup-item, .mockup-reminder, .chat-bubble, .plan-step'
  );

  animateElements.forEach((el, index) => {
    el.classList.add('fade-in');
    el.style.transitionDelay = `${index % 3 * 0.1}s`;
    observer.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', initAnimations);

// ===== Active Navigation Highlight =====
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  const scrollPos = window.scrollY + 100;

  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const navLink = document.querySelector(`.nav-links a[href="#${id}"]`);

    if (navLink) {
      if (scrollPos >= top && scrollPos < top + height) {
        navLink.style.color = 'var(--primary)';
        navLink.style.fontWeight = '600';
      } else {
        navLink.style.color = '';
        navLink.style.fontWeight = '';
      }
    }
  });
});
