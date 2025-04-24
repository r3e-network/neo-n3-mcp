/**
 * Neo N3 MCP Server - Enhanced Navigation Bar JavaScript
 * Handles navigation bar functionality across all pages
 */

document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const navbar = document.querySelector('.navbar-neo');
  const navbarCollapse = document.querySelector('.navbar-collapse');
  const navbarToggler = document.querySelector('.navbar-toggler');
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
  const dropdownItems = document.querySelectorAll('.dropdown-item');

  // Add padding to body to account for fixed navbar
  if (navbar) {
    const navbarHeight = navbar.offsetHeight;
    document.body.style.paddingTop = navbarHeight + 'px';

    // Shrink navbar on scroll with throttling for performance
    let lastScrollTop = 0;
    let ticking = false;

    window.addEventListener('scroll', function() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (!ticking) {
        window.requestAnimationFrame(function() {
          if (scrollTop > 50) {
            navbar.classList.add('scrolled');
          } else {
            navbar.classList.remove('scrolled');
          }

          // Update body padding when navbar height changes
          if (Math.abs(scrollTop - lastScrollTop) > 10) {
            const newNavbarHeight = navbar.offsetHeight;
            document.body.style.paddingTop = newNavbarHeight + 'px';
            lastScrollTop = scrollTop;
          }

          ticking = false;
        });

        ticking = true;
      }
    });

    // Also update on resize
    window.addEventListener('resize', function() {
      const navbarHeight = navbar.offsetHeight;
      document.body.style.paddingTop = navbarHeight + 'px';
    });
  }

  // Set active nav link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Handle active state for nav links
  navLinks.forEach(link => {
    const href = link.getAttribute('href');

    // Check if this is the current page
    if (href === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');

      // If this is in a dropdown, also mark the parent dropdown as active
      const dropdownParent = link.closest('.dropdown');
      if (dropdownParent) {
        const dropdownToggle = dropdownParent.querySelector('.dropdown-toggle');
        if (dropdownToggle) {
          dropdownToggle.classList.add('active');
        }
      }
    }
  });

  // Also check dropdown items
  dropdownItems.forEach(item => {
    const href = item.getAttribute('href');

    if (href === currentPage) {
      item.classList.add('active');

      // Mark the parent dropdown toggle as active
      const dropdownParent = item.closest('.dropdown');
      if (dropdownParent) {
        const dropdownToggle = dropdownParent.querySelector('.dropdown-toggle');
        if (dropdownToggle) {
          dropdownToggle.classList.add('active');
        }
      }
    }
  });

  // Handle dropdown menus on mobile
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      if (window.innerWidth < 992) {
        e.preventDefault();

        // Close other open dropdowns first
        dropdownToggles.forEach(otherToggle => {
          if (otherToggle !== toggle) {
            const otherParent = otherToggle.closest('.dropdown');
            if (otherParent && otherParent.classList.contains('show')) {
              otherParent.classList.remove('show');
              const otherMenu = otherParent.querySelector('.dropdown-menu');
              if (otherMenu) otherMenu.classList.remove('show');
            }
          }
        });

        // Toggle this dropdown
        const parent = this.closest('.dropdown');
        parent.classList.toggle('show');
        const menu = parent.querySelector('.dropdown-menu');

        if (menu) {
          menu.classList.toggle('show');

          // Add animation class if opening
          if (menu.classList.contains('show')) {
            menu.style.display = 'block';
          } else {
            // Delay hiding to allow animation to complete
            setTimeout(() => {
              if (!menu.classList.contains('show')) {
                menu.style.display = '';
              }
            }, 300);
          }
        }
      }
    });
  });

  // Close navbar when clicking outside
  document.addEventListener('click', function(e) {
    if (
      navbarCollapse &&
      navbarCollapse.classList.contains('show') &&
      !navbarCollapse.contains(e.target) &&
      !navbarToggler.contains(e.target)
    ) {
      navbarToggler.click();
    }
  });

  // Close navbar when clicking on a nav link (mobile)
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      if (
        window.innerWidth < 992 &&
        navbarCollapse &&
        navbarCollapse.classList.contains('show') &&
        !this.classList.contains('dropdown-toggle')
      ) {
        navbarToggler.click();
      }
    });
  });

  // Close navbar when clicking on a dropdown item (mobile)
  dropdownItems.forEach(item => {
    item.addEventListener('click', function() {
      if (
        window.innerWidth < 992 &&
        navbarCollapse &&
        navbarCollapse.classList.contains('show')
      ) {
        navbarToggler.click();
      }
    });
  });
});
