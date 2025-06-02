// Modern Interactions for Neo N3 MCP Website

// Intersection Observer for scroll animations
const observeElements = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    // Observe elements with animation classes
    document.querySelectorAll('.animate-on-scroll, .feature-card, .doc-card, .example-card, .stat').forEach(el => {
        observer.observe(el);
    });
};

// Enhanced scroll effects
const initScrollEffects = () => {
    let ticking = false;

    const updateScrollEffects = () => {
        const scrollTop = window.pageYOffset;
        const navbar = document.querySelector('.navbar');
        const hero = document.querySelector('.hero');

        // Navbar background opacity
        if (navbar) {
            const opacity = Math.min(scrollTop / 100, 1);
            navbar.style.background = `rgba(255, 255, 255, ${0.7 + opacity * 0.2})`;
        }

        // Parallax effect for hero background
        if (hero) {
            const heroHeight = hero.offsetHeight;
            if (scrollTop < heroHeight) {
                const translateY = scrollTop * 0.5;
                hero.style.transform = `translateY(${translateY}px)`;
            }
        }

        ticking = false;
    };

    const onScroll = () => {
        if (!ticking) {
            requestAnimationFrame(updateScrollEffects);
            ticking = true;
        }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
};

// Enhanced button interactions
const initButtonEffects = () => {
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('mouseenter', function(e) {
            const rect = this.getBoundingClientRect();
            const ripple = document.createElement('span');
            const size = Math.max(rect.width, rect.height);
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
            ripple.style.top = e.clientY - rect.top - size / 2 + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 1000);
        });
    });
};

// Smooth scrolling for anchor links
const initSmoothScrolling = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const navbarHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = target.offsetTop - navbarHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
};

// Enhanced terminal typing animation
const initTerminalAnimation = () => {
    const terminal = document.querySelector('.terminal-body');
    if (!terminal) return;

    const lines = terminal.querySelectorAll('.terminal-line');
    lines.forEach((line, index) => {
        line.style.opacity = '0';
        line.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            line.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            line.style.opacity = '1';
            line.style.transform = 'translateY(0)';
        }, index * 300);
    });
};

// Enhanced card hover effects
const initCardEffects = () => {
    document.querySelectorAll('.feature-card, .doc-card, .example-card').forEach(card => {
        card.addEventListener('mouseenter', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.style.setProperty('--mouse-x', x + 'px');
            this.style.setProperty('--mouse-y', y + 'px');
        });
        
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.style.setProperty('--mouse-x', x + 'px');
            this.style.setProperty('--mouse-y', y + 'px');
        });
    });
};

// Mobile menu toggle enhancement
const initMobileMenu = () => {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('nav-open');
        });
        
        // Close menu when clicking on a link
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.classList.remove('nav-open');
            });
        });
    }
};

// Enhanced copy button functionality
const initEnhancedCopyButtons = () => {
    document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', async function() {
            const codeBlock = this.closest('.code-block');
            const code = codeBlock.querySelector('code, pre').textContent;
            
            try {
                await navigator.clipboard.writeText(code);
                
                // Enhanced feedback
                const originalText = this.textContent;
                this.textContent = '✓ Copied!';
                this.classList.add('copied');
                
                // Add success animation
                this.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.classList.remove('copied');
                }, 2000);
                
            } catch (err) {
                console.error('Failed to copy text: ', err);
                this.textContent = 'Failed';
                setTimeout(() => {
                    this.textContent = 'Copy';
                }, 2000);
            }
        });
    });
};

// Tab functionality enhancement
const initEnhancedTabs = () => {
    document.querySelectorAll('.tab-button, .code-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const container = this.closest('.method-tabs, .code-tabs').parentElement;
            const targetTab = this.dataset.tab;
            
            // Enhanced tab switching with animation
            container.querySelectorAll('.tab-button, .code-tab').forEach(t => {
                t.classList.remove('active');
                t.style.transform = 'scale(1)';
            });
            
            this.classList.add('active');
            this.style.transform = 'scale(1.05)';
            
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            // Show corresponding content with fade effect
            container.querySelectorAll('.tab-content, [data-tab-content]').forEach(content => {
                content.style.opacity = '0';
                content.style.transform = 'translateY(10px)';
                
                setTimeout(() => {
                    if (content.dataset.tab === targetTab || content.dataset.tabContent === targetTab) {
                        content.style.display = 'block';
                        setTimeout(() => {
                            content.style.opacity = '1';
                            content.style.transform = 'translateY(0)';
                        }, 50);
                    } else {
                        content.style.display = 'none';
                    }
                }, 150);
            });
        });
    });
};

// Preloader functionality
const initPreloader = () => {
    const preloader = document.querySelector('.preloader');
    if (preloader) {
        window.addEventListener('load', () => {
            preloader.style.opacity = '0';
            preloader.style.transform = 'scale(1.1)';
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 300);
        });
    }
};

// Enhanced search functionality (if search exists)
const initEnhancedSearch = () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        let searchTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = this.value.toLowerCase();
                const searchResults = document.querySelector('.search-results');
                
                if (query.length > 2) {
                    // Simulate search results with animation
                    if (searchResults) {
                        searchResults.style.opacity = '0';
                        searchResults.style.transform = 'translateY(-10px)';
                        
                        setTimeout(() => {
                            searchResults.style.opacity = '1';
                            searchResults.style.transform = 'translateY(0)';
                        }, 100);
                    }
                }
            }, 300);
        });
    }
};

// Add CSS for additional animations
const addDynamicStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
        }
        
        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        .nav-open {
            overflow: hidden;
        }
        
        @media (max-width: 768px) {
            .nav-menu {
                position: fixed;
                top: 72px;
                left: 0;
                right: 0;
                background: var(--glass-bg);
                backdrop-filter: var(--glass-blur);
                border-bottom: 1px solid var(--glass-border);
                flex-direction: column;
                padding: 2rem;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
                z-index: 1000;
            }
            
            .nav-menu.active {
                transform: translateY(0);
            }
        }
        
        .preloader {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--gradient-hero);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            transition: all 0.3s ease;
        }
        
        .preloader::before {
            content: '';
            width: 50px;
            height: 50px;
            border: 3px solid rgba(0, 255, 136, 0.3);
            border-top: 3px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
};

// Performance optimization
const initPerformanceOptimizations = () => {
    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
    // Preload critical resources
    const criticalResources = [
        '/assets/css/style.css',
        '/assets/css/modern-enhancements.css'
    ];
    
    criticalResources.forEach(resource => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = resource;
        document.head.appendChild(link);
    });
};

// Initialize all enhancements
const initModernInteractions = () => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        addDynamicStyles();
        observeElements();
        initScrollEffects();
        initButtonEffects();
        initSmoothScrolling();
        initTerminalAnimation();
        initCardEffects();
        initMobileMenu();
        initEnhancedCopyButtons();
        initEnhancedTabs();
        initPreloader();
        initEnhancedSearch();
        initPerformanceOptimizations();
        
        // Add stagger animation to elements
        setTimeout(() => {
            document.querySelectorAll('.feature-card, .doc-card, .example-card').forEach((el, index) => {
                el.style.animationDelay = `${index * 0.1}s`;
                el.classList.add('animate-on-scroll');
            });
        }, 100);
    }
};

// Auto-initialize
initModernInteractions();

// Export for manual initialization if needed
window.ModernInteractions = {
    init: initModernInteractions,
    observeElements,
    initScrollEffects,
    initButtonEffects,
    initSmoothScrolling,
    initTerminalAnimation,
    initCardEffects,
    initMobileMenu,
    initEnhancedCopyButtons,
    initEnhancedTabs
}; 