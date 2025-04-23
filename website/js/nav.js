// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  
  if (menuToggle) {
    menuToggle.addEventListener('click', function() {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !expanded);
      mainNav.classList.toggle('open');
    });
  }
  
  // Handle dropdown menus on mobile
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      // Only handle clicks on mobile view
      if (window.innerWidth <= 1024) {
        e.preventDefault();
        const dropdown = this.closest('.dropdown');
        dropdown.classList.toggle('open');
        
        const expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', !expanded);
      }
    });
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', function(e) {
    if (mainNav && mainNav.classList.contains('open') && !mainNav.contains(e.target)) {
      mainNav.classList.remove('open');
      if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    }
  });
  
  // Handle keyboard navigation
  const dropdowns = document.querySelectorAll('.dropdown');
  
  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    const menuItems = menu.querySelectorAll('a');
    
    toggle.addEventListener('keydown', function(e) {
      // Open dropdown on Enter or Space
      if ((e.key === 'Enter' || e.key === ' ') && window.innerWidth > 1024) {
        e.preventDefault();
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        menuItems[0].focus();
      }
      
      // Close dropdown on Escape
      if (e.key === 'Escape') {
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Handle keyboard navigation within dropdown
    menuItems.forEach((item, index) => {
      item.addEventListener('keydown', function(e) {
        // Close dropdown on Escape
        if (e.key === 'Escape') {
          dropdown.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
        }
        
        // Navigate to next/previous item
        if (e.key === 'ArrowDown' && index < menuItems.length - 1) {
          e.preventDefault();
          menuItems[index + 1].focus();
        }
        
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (index > 0) {
            menuItems[index - 1].focus();
          } else {
            toggle.focus();
            dropdown.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
          }
        }
      });
    });
  });
  
  // Add active class to parent dropdown if child is active
  const activeDropdownItem = document.querySelector('.dropdown-menu .active');
  if (activeDropdownItem) {
    const parentDropdown = activeDropdownItem.closest('.dropdown');
    if (parentDropdown) {
      const parentToggle = parentDropdown.querySelector('.dropdown-toggle');
      parentToggle.classList.add('active');
    }
  }
});
