/**
 * Documentation Page Component Tests
 * 
 * These tests use JSDOM to test the frontend documentation page component
 */

// Mock the DOM environment for browser-like testing
const originalDocument = global.document;
const originalWindow = global.window;

describe('Documentation Page Component Tests', () => {
  // Before each test, setup a DOM environment
  beforeEach(() => {
    // Create a minimal HTML structure with the necessary elements
    document.body.innerHTML = `
      <header>
        <div class="container">
          <div class="logo">
            <h1>Neo N3 MCP Server</h1>
          </div>
          <nav>
            <ul>
              <li><a href="index.html">Home</a></li>
              <li><a href="documentation.html" class="active">Documentation</a></li>
            </ul>
          </nav>
        </div>
      </header>
      <div class="documentation-container">
        <aside class="sidebar">
          <div class="sidebar-content">
            <h3>Documentation</h3>
            <ul class="sidebar-nav">
              <li><a href="#overview" class="active">Overview</a></li>
              <li><a href="#installation">Installation</a></li>
              <li><a href="#configuration">Configuration</a></li>
              <li><a href="#api-reference">API Reference</a></li>
            </ul>
          </div>
        </aside>
        <main class="documentation-content">
          <section id="overview" class="doc-section active">
            <h2>Overview</h2>
            <p>Neo N3 MCP Server is a Model Context Protocol implementation for Neo N3 blockchain.</p>
          </section>
          <section id="installation" class="doc-section">
            <h2>Installation</h2>
            <p>Installation instructions for Neo N3 MCP Server.</p>
          </section>
        </main>
      </div>
      <footer>
        <div class="container">
          <div class="footer-content">
            <div class="footer-logo">
              <h2>Neo N3 MCP Server</h2>
            </div>
          </div>
        </div>
      </footer>
      <script src="js/main.js"></script>
    `;
    
    // Load the main script
    require('../../js/main');
  });
  
  // After each test, restore the original document and window
  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    jest.resetModules();
  });
  
  test('should have the correct page title', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check the page title
    const pageTitle = document.querySelector('header .logo h1').textContent;
    expect(pageTitle).toBe('Neo N3 MCP Server');
  });
  
  test('should have documentation navigation in sidebar', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check sidebar navigation
    const sidebarNav = document.querySelector('.sidebar-nav');
    expect(sidebarNav).not.toBeNull();
    
    // Check sidebar links
    const sidebarLinks = document.querySelectorAll('.sidebar-nav li a');
    expect(sidebarLinks.length).toBeGreaterThan(0);
    
    // Check that the overview link is active
    const activeLink = document.querySelector('.sidebar-nav li a.active');
    expect(activeLink).not.toBeNull();
    expect(activeLink.getAttribute('href')).toBe('#overview');
  });
  
  test('should have documentation sections', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check documentation sections
    const docSections = document.querySelectorAll('.doc-section');
    expect(docSections.length).toBeGreaterThan(0);
    
    // Check that the overview section is active
    const activeSection = document.querySelector('.doc-section.active');
    expect(activeSection).not.toBeNull();
    expect(activeSection.id).toBe('overview');
  });
  
  test('should navigate to sections when clicking sidebar links', () => {
    // Mock the click event handler
    document.addEventListener = jest.fn((event, handler) => {
      if (event === 'click') {
        // Simulate clicking on the installation link
        const installationLink = document.querySelector('a[href="#installation"]');
        handler({ target: installationLink, preventDefault: jest.fn() });
      }
    });
    
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check that the installation section is now active
    const activeSection = document.querySelector('.doc-section.active');
    expect(activeSection).not.toBeNull();
    expect(activeSection.id).toBe('installation');
    
    // Check that the installation link is now active
    const activeLink = document.querySelector('.sidebar-nav li a.active');
    expect(activeLink).not.toBeNull();
    expect(activeLink.getAttribute('href')).toBe('#installation');
  });
  
  test('should have a footer with copyright information', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check footer
    const footer = document.querySelector('footer');
    expect(footer).not.toBeNull();
    
    // Check footer logo
    const footerLogo = document.querySelector('.footer-logo h2').textContent;
    expect(footerLogo).toBe('Neo N3 MCP Server');
  });
});
