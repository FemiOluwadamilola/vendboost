// HAMBURGER
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// DARK MODE
const themeToggle = document.getElementById('themeToggle');

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    themeToggle.textContent =
        document.body.classList.contains('dark') ? '☀️' : '🌙';
});

// SCROLL REVEAL
function revealOnScroll() {
    const reveals = document.querySelectorAll('.reveal');

    reveals.forEach((el) => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;

        if (elementTop < windowHeight - 100) {
            el.classList.add('active');
        }
    });
}

function togglePassword() {
    const password = document.getElementById("password");
    password.type = password.type === "password" ? "text" : "password";
}

const form = document.getElementById("authForm");
const btn = document.getElementById("submitBtn");
const errorAlert = document.getElementById("errorAlert");

form.addEventListener("submit", function (e) {
    e.preventDefault();

    btn.classList.add("loading");

    setTimeout(() => {
        btn.classList.remove("loading");

        // Simulate error
        errorAlert.classList.add("show");
    }, 2000);
});

window.addEventListener('scroll', revealOnScroll);
revealOnScroll();