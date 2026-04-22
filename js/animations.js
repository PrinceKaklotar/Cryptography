/**
 * animations.js – Scroll-reveal, counter animations, particle effects
 */
'use strict';

// ─── Scroll-reveal observer ───
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

// ─── Counter animation ───
function animateCounter(el, target, duration = 1800, suffix = '') {
  const start = performance.now();
  const startVal = 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const val = Math.round(startVal + (target - startVal) * eased);
    el.textContent = val.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// Observe stat cards
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.dataset.animated) {
      entry.target.dataset.animated = 'true';
      const numEl = entry.target.querySelector('[data-count]');
      if (numEl) {
        const target = parseInt(numEl.dataset.count, 10);
        const suffix = numEl.dataset.suffix || '';
        animateCounter(numEl, target, 1800, suffix);
      }
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-card').forEach(el => counterObserver.observe(el));

// ─── Sidebar nav active on scroll (how-it-works, math-details) ───
(function initSidebarHighlight() {
  const sidebarLinks = document.querySelectorAll('.sidebar-nav a[href^="#"]');
  if (!sidebarLinks.length) return;

  const sections = Array.from(sidebarLinks).map(link => {
    const id = link.getAttribute('href').slice(1);
    return { link, el: document.getElementById(id) };
  }).filter(({ el }) => el);

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sidebarLinks.forEach(l => l.classList.remove('active'));
        const active = sections.find(s => s.el === entry.target);
        if (active) active.link.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  sections.forEach(({ el }) => obs.observe(el));
})();

// ─── Typing effect ───
function typeText(el, text, speed = 30) {
  return new Promise(resolve => {
    el.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}

window.typeText = typeText;

// ─── Smooth reveal for hero elements ───
(function heroEntrance() {
  const hero = document.querySelector('.hero-content');
  if (!hero) return;

  const children = hero.children;
  Array.from(children).forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`;
    requestAnimationFrame(() => {
      setTimeout(() => {
        el.style.opacity = '';
        el.style.transform = '';
      }, 100);
    });
  });
})();

// ─── Particle system for hero ───
(function initParticles() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const PARTICLE_COUNT = 18;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 2;
    const left = Math.random() * 100;
    const delay = Math.random() * 15;
    const duration = Math.random() * 12 + 10;
    p.style.cssText = `
      left: ${left}%;
      bottom: 0;
      width: ${size}px;
      height: ${size}px;
      animation-delay: ${delay}s;
      animation-duration: ${duration}s;
      background: ${Math.random() > 0.5 ? 'var(--cyan)' : 'var(--purple)'};
      opacity: ${Math.random() * 0.4 + 0.1};
    `;
    hero.appendChild(p);
  }
})();

// ─── Flow diagram animate on scroll ───
const flowObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const boxes = entry.target.querySelectorAll('.flow-box');
      boxes.forEach((box, i) => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(10px)';
        setTimeout(() => {
          box.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          box.style.opacity = '';
          box.style.transform = '';
        }, i * 100);
      });
      flowObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.flow-diagram').forEach(el => flowObserver.observe(el));
