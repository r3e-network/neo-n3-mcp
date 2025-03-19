/**
 * Neo N3 MCP Server Website JavaScript
 * Powered by R3E Network
 */

// Make sure the DOM is loaded before executing any code
document.addEventListener('DOMContentLoaded', function() {
  // Page transition effect
  setupPageTransition();
  
  // Mobile navigation toggle
  setupMobileNav();
  
  // Highlight active sidebar item based on scroll position
  setupSidebarHighlighting();
  
  // Setup code copy buttons
  setupCodeCopyButtons();
  
  // Setup smooth scrolling for anchor links
  setupSmoothScrolling();
  
  // Header scroll effect
  setupHeaderScroll();
  
  // Setup animation on scroll
  setupScrollAnimation();
  
  // Setup interactive cards
  setupInteractiveCards();
});

/**
 * Page transition effect
 */
function setupPageTransition() {
  // Create transition element
  const transitionEl = document.createElement('div');
  transitionEl.className = 'page-transition';
  
  const logoEl = document.createElement('div');
  logoEl.className = 'page-transition-logo';
  transitionEl.appendChild(logoEl);
  
  document.body.appendChild(transitionEl);
  
  // Remove transition after page is fully loaded
  window.addEventListener('load', function() {
    setTimeout(function() {
      transitionEl.classList.add('loaded');
      
      // Remove element after animation
      setTimeout(function() {
        document.body.removeChild(transitionEl);
      }, 600);
    }, 500);
  });
}

/**
 * Setup mobile navigation
 */
function setupMobileNav() {
  // Create mobile menu button
  const header = document.querySelector('header');
  const nav = document.querySelector('nav');
  
  if (!header || !nav) return;
  
  const mobileMenuBtn = document.createElement('button');
  mobileMenuBtn.className = 'mobile-menu-btn';
  mobileMenuBtn.innerHTML = '<span></span><span></span><span></span>';
  mobileMenuBtn.setAttribute('aria-label', 'Toggle mobile menu');
  
  header.querySelector('.container').appendChild(mobileMenuBtn);
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      width: 30px;
      height: 20px;
      position: relative;
      cursor: pointer;
      z-index: 100;
    }
    
    .mobile-menu-btn span {
      display: block;
      position: absolute;
      height: 3px;
      width: 100%;
      background: var(--dark-color);
      border-radius: 3px;
      opacity: 1;
      left: 0;
      transform: rotate(0deg);
      transition: .25s ease-in-out;
    }
    
    .mobile-menu-btn span:nth-child(1) {
      top: 0px;
    }
    
    .mobile-menu-btn span:nth-child(2) {
      top: 8px;
    }
    
    .mobile-menu-btn span:nth-child(3) {
      top: 16px;
    }
    
    .mobile-menu-btn.open span:nth-child(1) {
      top: 8px;
      transform: rotate(135deg);
    }
    
    .mobile-menu-btn.open span:nth-child(2) {
      opacity: 0;
      left: -60px;
    }
    
    .mobile-menu-btn.open span:nth-child(3) {
      top: 8px;
      transform: rotate(-135deg);
    }
    
    @media (max-width: 768px) {
      .mobile-menu-btn {
        display: block;
      }
      
      nav {
        position: fixed;
        top: 0;
        right: -100%;
        width: 250px;
        height: 100vh;
        background: white;
        z-index: 99;
        box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
        transition: right 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      nav.open {
        right: 0;
      }
      
      nav ul {
        flex-direction: column;
        width: 100%;
        padding: 20px;
      }
      
      nav li {
        margin: 10px 0;
        width: 100%;
        text-align: center;
      }
      
      .nav-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 98;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease;
      }
      
      .nav-overlay.visible {
        opacity: 1;
        visibility: visible;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  document.body.appendChild(overlay);
  
  // Toggle menu
  mobileMenuBtn.addEventListener('click', function() {
    mobileMenuBtn.classList.toggle('open');
    nav.classList.toggle('open');
    overlay.classList.toggle('visible');
    document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
  });
  
  // Close menu when clicking overlay
  overlay.addEventListener('click', function() {
    mobileMenuBtn.classList.remove('open');
    nav.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  });
}

/**
 * Highlight active sidebar item based on scroll position
 */
function setupSidebarHighlighting() {
  const sections = document.querySelectorAll('main section[id]');
  const sidebarLinks = document.querySelectorAll('.sidebar-content a');
  
  if (sections.length === 0 || sidebarLinks.length === 0) return;
  
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.2
  };
  
  const observerCallback = (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const currentSection = entry.target.getAttribute('id');
        
        sidebarLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
          }
        });
      }
    });
  };
  
  const observer = new IntersectionObserver(observerCallback, observerOptions);
  
  sections.forEach(section => {
    observer.observe(section);
  });
}

/**
 * Setup code copy buttons
 */
function setupCodeCopyButtons() {
  const codeBlocks = document.querySelectorAll('pre code');
  
  codeBlocks.forEach((codeBlock, index) => {
    const pre = codeBlock.parentNode;
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    copyButton.setAttribute('aria-label', 'Copy code to clipboard');
    
    pre.style.position = 'relative';
    pre.appendChild(copyButton);
    
    copyButton.addEventListener('click', function() {
      const code = codeBlock.textContent;
      navigator.clipboard.writeText(code).then(() => {
        copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => {
          copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        }, 2000);
      }, (err) => {
        console.error('Could not copy text: ', err);
        copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        setTimeout(() => {
          copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        }, 2000);
      });
    });
    
    // Add styles for the copy button
    const style = document.createElement('style');
    style.textContent = `
      .copy-button {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        padding: 0.4rem;
        background-color: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: #999;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .copy-button:hover {
        background-color: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
      .copy-button svg {
        width: 16px;
        height: 16px;
      }
    `;
    document.head.appendChild(style);
  });
}

/**
 * Setup smooth scrolling for anchor links
 */
function setupSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        e.preventDefault();
        
        const headerHeight = document.querySelector('header').offsetHeight;
        
        window.scrollTo({
          top: targetElement.offsetTop - headerHeight,
          behavior: 'smooth'
        });
        
        // Update URL hash without jumping
        history.pushState(null, null, targetId);
        
        // Close mobile menu if open
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const nav = document.querySelector('nav');
        const overlay = document.querySelector('.nav-overlay');
        
        if (mobileMenuBtn && mobileMenuBtn.classList.contains('open')) {
          mobileMenuBtn.classList.remove('open');
          nav.classList.remove('open');
          overlay.classList.remove('visible');
          document.body.style.overflow = '';
        }
      }
    });
  });
}

/**
 * Header scroll effect
 */
function setupHeaderScroll() {
  const header = document.querySelector('header');
  if (!header) return;
  
  window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  });
}

/**
 * Setup animation on scroll
 */
function setupScrollAnimation() {
  // Only run this function if not on a mobile device
  if (window.innerWidth < 768) return;
  
  const elements = document.querySelectorAll('.feature-card, .contract-card, .hero-content h1, .hero-content p, .hero-buttons, .hero-image, .quick-start-content, section h2');
  
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };
  
  const observerCallback = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  };
  
  const observer = new IntersectionObserver(observerCallback, observerOptions);
  
  elements.forEach(element => {
    // Skip elements that already have animation
    if (element.classList.contains('hero-content') || 
        element.classList.contains('hero-buttons') || 
        element.classList.contains('hero-image') ||
        element.parentElement.classList.contains('hero-content')) {
      return;
    }
    
    element.style.opacity = '0';
    element.style.transform = 'translateY(30px)';
    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(element);
  });
}

/**
 * Setup interactive cards
 */
function setupInteractiveCards() {
  const cards = document.querySelectorAll('.feature-card, .contract-card');
  if (cards.length === 0) return;
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = this.classList.contains('contract-card') ? 
        'translateY(-10px) scale(1.03)' : 'translateY(-10px)';
      this.style.boxShadow = 'var(--hover-shadow)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0) scale(1)';
      this.style.boxShadow = 'var(--box-shadow)';
    });
  });
}

/**
 * Setup dark mode toggle (optional feature)
 */
function setupDarkModeToggle() {
  // Create toggle button
  const header = document.querySelector('header');
  if (!header) return;
  
  const darkModeToggle = document.createElement('button');
  darkModeToggle.className = 'dark-mode-toggle';
  darkModeToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  darkModeToggle.setAttribute('aria-label', 'Toggle dark mode');
  
  const nav = header.querySelector('nav ul');
  const li = document.createElement('li');
  li.appendChild(darkModeToggle);
  nav.appendChild(li);
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .dark-mode-toggle {
      background: none;
      border: none;
      color: var(--text-color);
      cursor: pointer;
      padding: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
    }
    
    .dark-mode-toggle:hover {
      color: var(--primary-color);
    }
    
    .dark-mode .dark-mode-toggle {
      color: white;
    }
    
    .dark-mode .dark-mode-toggle svg {
      transform: rotate(45deg);
    }
  `;
  document.head.appendChild(style);
  
  // Check for saved preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
  
  // Toggle dark mode
  darkModeToggle.addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    
    // Save preference
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
} 