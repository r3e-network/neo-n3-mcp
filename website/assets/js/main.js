// Neo N3 MCP Website JavaScript

/**
 * Main JavaScript functionality for the Neo N3 MCP website
 * Handles interactive features, animations, and user experience enhancements
 */

class NeoMCPWebsite {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeComponents();
        this.setupScrollAnimations();
        this.setupNavigation();
        this.setupTabs();
        this.setupCopyButtons();
        this.setupMobileNavigation();
        this.setupTerminalAnimation();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // DOM content loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.onDOMContentLoaded();
            });
        } else {
            this.onDOMContentLoaded();
        }

        // Window events
        window.addEventListener('scroll', this.throttle(this.handleScroll.bind(this), 16));
        window.addEventListener('resize', this.throttle(this.handleResize.bind(this), 250));
        
        // Prevent flash of unstyled content
        document.documentElement.classList.add('js-enabled');
    }

    /**
     * Initialize components after DOM is loaded
     */
    onDOMContentLoaded() {
        this.updateNavbarOnScroll();
        this.animateCounters();
        this.setupSmoothScrolling();
    }

    /**
     * Initialize all components
     */
    initializeComponents() {
        console.log('🚀 Neo N3 MCP Website initialized');
    }

    /**
     * Setup scroll-based animations
     */
    setupScrollAnimations() {
        // Intersection Observer for scroll animations
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -100px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        // Observe elements with animate-on-scroll class
        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });

        // Add animation classes to sections
        const animatedSections = document.querySelectorAll('.feature-card, .example-card, .doc-card');
        animatedSections.forEach(section => {
            section.classList.add('animate-on-scroll');
        });
    }

    /**
     * Setup smooth scrolling navigation
     */
    setupNavigation() {
        const navLinks = document.querySelectorAll('a[href^="#"]');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    const headerOffset = 80;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    /**
     * Setup tab functionality
     */
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                const targetContent = document.querySelector(`[data-tab="${targetTab}"].tab-content`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    /**
     * Setup copy button functionality
     */
    setupCopyButtons() {
        const copyButtons = document.querySelectorAll('.copy-button');

        copyButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const textToCopy = button.getAttribute('data-copy');
                
                if (textToCopy) {
                    try {
                        // Decode HTML entities and newlines
                        const decodedText = textToCopy
                            .replace(/&#10;/g, '\n')
                            .replace(/&#92;/g, '\\')
                            .replace(/&quot;/g, '"')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&');

                        await navigator.clipboard.writeText(decodedText);
                        
                        // Visual feedback
                        const originalText = button.textContent;
                        button.textContent = 'Copied!';
                        button.style.background = '#10b981';
                        
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.style.background = '';
                        }, 2000);
                        
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                        
                        // Fallback for older browsers
                        this.fallbackCopyTextToClipboard(decodedText);
                        
                        // Visual feedback for fallback
                        const originalText = button.textContent;
                        button.textContent = 'Copied!';
                        setTimeout(() => {
                            button.textContent = originalText;
                        }, 2000);
                    }
                }
            });
        });
    }

    /**
     * Fallback copy method for older browsers
     */
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    }

    /**
     * Setup mobile navigation
     */
    setupMobileNavigation() {
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
                
                // Prevent body scroll when menu is open
                document.body.classList.toggle('nav-open');
            });

            // Close menu when clicking on a link
            const navLinks = navMenu.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                    document.body.classList.remove('nav-open');
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                    document.body.classList.remove('nav-open');
                }
            });
        }
    }

    /**
     * Setup terminal animation
     */
    setupTerminalAnimation() {
        const terminalLines = document.querySelectorAll('.terminal-line');
        
        // Animate terminal lines appearing one by one
        terminalLines.forEach((line, index) => {
            line.style.opacity = '0';
            line.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                line.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                line.style.opacity = '1';
                line.style.transform = 'translateY(0)';
            }, index * 500 + 1000); // Delay each line
        });
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        this.updateNavbarOnScroll();
        this.updateActiveNavLink();
    }

    /**
     * Update navbar appearance on scroll
     */
    updateNavbarOnScroll() {
        const navbar = document.querySelector('.navbar');
        const scrollTop = window.pageYOffset;

        if (scrollTop > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    /**
     * Update active navigation link based on scroll position
     */
    updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
        
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.getBoundingClientRect().top;
            const sectionHeight = section.offsetHeight;
            
            if (sectionTop <= 100 && sectionTop + sectionHeight > 100) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Close mobile menu on resize to desktop
        if (window.innerWidth > 768) {
            const navMenu = document.querySelector('.nav-menu');
            const navToggle = document.querySelector('.nav-toggle');
            
            if (navMenu && navToggle) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                document.body.classList.remove('nav-open');
            }
        }
    }

    /**
     * Setup smooth scrolling for all internal links
     */
    setupSmoothScrolling() {
        // Enable smooth scrolling for the whole page
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    /**
     * Animate counters/stats
     */
    animateCounters() {
        const counters = document.querySelectorAll('.stat-number');
        
        const animateCounter = (counter) => {
            const target = parseInt(counter.textContent.replace(/\D/g, ''));
            const duration = 2000;
            const step = target / (duration / 16);
            let current = 0;
            
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                
                const originalText = counter.textContent;
                const suffix = originalText.replace(/[\d]/g, '');
                counter.textContent = Math.floor(current) + suffix;
            }, 16);
        };

        // Intersection Observer for counter animation
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => {
            counterObserver.observe(counter);
        });
    }

    /**
     * Throttle function for performance
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Debounce function for performance
     */
    debounce(func, wait, immediate) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
}

// Utility functions for global use

/**
 * Show notification toast
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add styles
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 24px',
        borderRadius: '6px',
        color: 'white',
        fontWeight: '500',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        backgroundColor: type === 'success' ? '#10b981' : 
                        type === 'error' ? '#ef4444' : '#3b82f6'
    });
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

/**
 * Format code block with syntax highlighting
 */
function formatCodeBlock(element) {
    if (window.Prism) {
        window.Prism.highlightElement(element);
    }
}

/**
 * Track analytics events (placeholder for actual analytics)
 */
function trackEvent(eventName, properties = {}) {
    // Placeholder for analytics tracking
    console.log('📊 Event tracked:', eventName, properties);
    
    // Example: Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, properties);
    }
    
    // Example: Mixpanel
    if (typeof mixpanel !== 'undefined') {
        mixpanel.track(eventName, properties);
    }
}

// Performance monitoring
function monitorPerformance() {
    if ('performance' in window) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                const loadTime = perfData.loadEventEnd - perfData.loadEventStart;
                
                console.log('⚡ Page load time:', loadTime + 'ms');
                trackEvent('page_load_time', { load_time: loadTime });
            }, 0);
        });
    }
}

// Error handling
window.addEventListener('error', (e) => {
    console.error('🐛 JavaScript error:', e.error);
    trackEvent('javascript_error', {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        column: e.colno
    });
});

// Initialize the website
const neoMCPWebsite = new NeoMCPWebsite();

// Monitor performance
monitorPerformance();

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NeoMCPWebsite, showToast, formatCodeBlock, trackEvent };
} 