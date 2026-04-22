/**
 * nav.js – Shared Navigation Logic
 * Handles: scroll effects, mobile menu, active link highlighting
 */
'use strict';

(function initNav() {
  const nav = document.querySelector('.nav');
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileMenu = document.querySelector('.nav-mobile');

  // Mark current page link as active
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Scroll effect
  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Mobile menu
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      const isOpen = mobileMenu.classList.contains('open');
      if (isOpen) {
        spans[0].style.transform = 'rotate(45deg) translate(5px,5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
      } else {
        spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      }
    });

    // Close mobile menu on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        const spans = hamburger.querySelectorAll('span');
        spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      });
    });
  }
})();

// ─── Toast Notifications ───
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(msg, type = 'info', duration = 4000) {
    this.init();
    const icons = { success: '✓', error: '✗', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span style="font-size:1.1rem">${icons[type] || 'ℹ'}</span> ${msg}`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }
};

window.Toast = Toast;

// ─── Copy code button ───
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', async () => {
    const pre = btn.closest('.code-block-header')?.nextElementSibling ||
                btn.closest('.code-block')?.querySelector('pre');
    if (!pre) return;
    try {
      await navigator.clipboard.writeText(pre.textContent);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    } catch {
      Toast.show('Copy failed. Please copy manually.', 'error');
    }
  });
});

// ─── Accordion ───
document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    const body = header.nextElementSibling;
    const isOpen = body?.classList.contains('open');

    // Close all in same accordion
    const parent = header.closest('.accordion');
    if (parent) {
      parent.querySelectorAll('.accordion-body.open').forEach(b => b.classList.remove('open'));
      parent.querySelectorAll('.accordion-header.active').forEach(h => h.classList.remove('active'));
    }

    if (!isOpen) {
      body?.classList.add('open');
      header.classList.add('active');
    }
  });
});

// ─── Tab Groups ───
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.closest('[data-tab-group]');
    if (!group) return;
    const target = btn.dataset.tab;

    group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    group.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const content = group.querySelector(`.tab-content[data-tab="${target}"]`);
    if (content) content.classList.add('active');
  });
});
