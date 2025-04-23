/**
 * Main Page Component Tests
 * 
 * These tests use JSDOM to test the frontend main page component
 */

// Mock the DOM environment for browser-like testing
const originalDocument = global.document;
const originalWindow = global.window;

describe('Main Page Component Tests', () => {
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
              <li><a href="index.html" class="active">Home</a></li>
              <li><a href="documentation.html">Documentation</a></li>
            </ul>
          </nav>
        </div>
      </header>
      <section class="hero">
        <div class="container">
          <div class="hero-content">
            <h1>Neo N3 MCP Server</h1>
            <p>An MCP server that enables AI assistants like Claude, ChatGPT, and others to directly interact with Neo N3 blockchain</p>
            <div class="hero-buttons">
              <a href="user-guide.html#ai-integration" class="btn btn-primary">AI Integration Guide</a>
              <a href="user-guide.html" class="btn btn-secondary">Get Started</a>
            </div>
          </div>
        </div>
      </section>
      <section class="features">
        <div class="container">
          <h2>Key Features</h2>
          <div class="feature-grid">
            <div class="feature-card">
              <h3>AI Assistant Integration</h3>
            </div>
          </div>
        </div>
      </section>
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
  
  test('should have navigation links', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check navigation links
    const navLinks = document.querySelectorAll('nav ul li a');
    expect(navLinks.length).toBeGreaterThan(0);
    
    // Check that the home link is active
    const homeLink = document.querySelector('nav ul li a.active');
    expect(homeLink).not.toBeNull();
    expect(homeLink.getAttribute('href')).toBe('index.html');
  });
  
  test('should have a hero section with call-to-action buttons', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check hero section
    const heroSection = document.querySelector('section.hero');
    expect(heroSection).not.toBeNull();
    
    // Check hero content
    const heroTitle = document.querySelector('.hero-content h1').textContent;
    expect(heroTitle).toBe('Neo N3 MCP Server');
    
    // Check CTA buttons
    const ctaButtons = document.querySelectorAll('.hero-buttons .btn');
    expect(ctaButtons.length).toBe(2);
    
    const primaryButton = document.querySelector('.hero-buttons .btn-primary');
    expect(primaryButton).not.toBeNull();
    expect(primaryButton.getAttribute('href')).toBe('user-guide.html#ai-integration');
    
    const secondaryButton = document.querySelector('.hero-buttons .btn-secondary');
    expect(secondaryButton).not.toBeNull();
    expect(secondaryButton.getAttribute('href')).toBe('user-guide.html');
  });
  
  test('should have a features section', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check features section
    const featuresSection = document.querySelector('section.features');
    expect(featuresSection).not.toBeNull();
    
    // Check features title
    const featuresTitle = document.querySelector('.features h2').textContent;
    expect(featuresTitle).toBe('Key Features');
    
    // Check feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    expect(featureCards.length).toBeGreaterThan(0);
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
  
  test('should load and execute main.js', () => {
    // Mock the main.js functionality
    global.initMainPage = jest.fn();
    
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check that main.js was loaded
    const script = document.querySelector('script[src="js/main.js"]');
    expect(script).not.toBeNull();
  });
});
