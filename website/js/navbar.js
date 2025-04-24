/**
 * Neo N3 MCP Server - Navigation Bar JavaScript
 * Handles navigation bar functionality across all pages
 */

document.addEventListener('DOMContentLoaded', function() {
  // Shrink navbar on scroll
  const navbar = document.querySelector('.navbar-neo');
  
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // Set active nav link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  // Handle dropdown menus on mobile
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      if (window.innerWidth < 992) {
        e.preventDefault();
        const parent = this.closest('.dropdown');
        parent.classList.toggle('show');
        const menu = parent.querySelector('.dropdown-menu');
        menu.classList.toggle('show');
      }
    });
  });
});
