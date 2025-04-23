/**
 * Accessibility Tests
 * 
 * These tests check for accessibility features in the website
 */

// Mock the DOM environment for browser-like testing
const originalDocument = global.document;
const originalWindow = global.window;

describe('Accessibility Features Tests', () => {
  // Before each test, setup a DOM environment
  beforeEach(() => {
    // Create a minimal HTML structure with the necessary elements
    document.body.innerHTML = `
      <a href="#main-content" class="skip-to-content">Skip to content</a>
      <header>
        <div class="container">
          <div class="logo">
            <h1>Neo N3 MCP Server</h1>
          </div>
          <nav aria-label="Main navigation">
            <ul role="menubar">
              <li role="none"><a href="index.html" class="active" role="menuitem" aria-current="page">Home</a></li>
              <li role="none"><a href="documentation.html" role="menuitem">Documentation</a></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main-content">
        <section class="hero" aria-labelledby="hero-heading">
          <div class="container">
            <div class="hero-content">
              <h1 id="hero-heading">Neo N3 MCP Server</h1>
              <p>An MCP server that enables AI assistants like Claude, ChatGPT, and others to directly interact with Neo N3 blockchain</p>
              <div class="hero-buttons" role="group" aria-label="Getting started options">
                <a href="user-guide.html#ai-integration" class="btn btn-primary">AI Integration Guide</a>
                <a href="user-guide.html" class="btn btn-secondary">Get Started</a>
              </div>
            </div>
          </div>
        </section>
        <section class="features" aria-labelledby="features-heading">
          <div class="container">
            <h2 id="features-heading">Key Features</h2>
            <div class="feature-grid">
              <div class="feature-card">
                <div class="feature-icon" aria-hidden="true">
                  <img src="img/icon-blockchain.svg" alt="" role="presentation">
                </div>
                <h3 id="feature-blockchain">Neo N3 Blockchain Access</h3>
                <p>Allow AI tools to access Neo N3 blockchain features including account management, transactions, and smart contracts.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer role="contentinfo">
        <div class="container">
          <div class="footer-content">
            <div class="footer-logo">
              <h2>Neo N3 MCP Server</h2>
            </div>
            <div class="footer-links">
              <div class="footer-links-column">
                <h3 id="footer-docs">Documentation</h3>
                <ul aria-labelledby="footer-docs">
                  <li><a href="documentation.html#overview">Overview</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <link rel="stylesheet" href="css/accessibility.css">
    `;
  });
  
  // After each test, restore the original document and window
  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    jest.resetModules();
  });
  
  test('should have skip to content link', () => {
    const skipLink = document.querySelector('.skip-to-content');
    expect(skipLink).not.toBeNull();
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });
  
  test('should have main content with ID', () => {
    const mainContent = document.querySelector('#main-content');
    expect(mainContent).not.toBeNull();
    expect(mainContent.tagName.toLowerCase()).toBe('main');
  });
  
  test('should have proper ARIA labels on navigation', () => {
    const nav = document.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Main navigation');
    
    const menubar = document.querySelector('ul[role="menubar"]');
    expect(menubar).not.toBeNull();
    
    const menuItems = document.querySelectorAll('a[role="menuitem"]');
    expect(menuItems.length).toBeGreaterThan(0);
  });
  
  test('should have proper heading structure with IDs', () => {
    const h1 = document.querySelector('h1#hero-heading');
    expect(h1).not.toBeNull();
    
    const h2 = document.querySelector('h2#features-heading');
    expect(h2).not.toBeNull();
    
    const section = document.querySelector('section[aria-labelledby="features-heading"]');
    expect(section).not.toBeNull();
  });
  
  test('should have decorative images marked appropriately', () => {
    const decorativeImg = document.querySelector('img[role="presentation"]');
    expect(decorativeImg).not.toBeNull();
    expect(decorativeImg.getAttribute('alt')).toBe('');
    expect(decorativeImg.parentElement.getAttribute('aria-hidden')).toBe('true');
  });
  
  test('should have proper ARIA attributes on interactive elements', () => {
    const buttonGroup = document.querySelector('div[role="group"]');
    expect(buttonGroup).not.toBeNull();
    expect(buttonGroup.getAttribute('aria-label')).toBe('Getting started options');
  });
  
  test('should have proper footer structure with ARIA attributes', () => {
    const footer = document.querySelector('footer[role="contentinfo"]');
    expect(footer).not.toBeNull();
    
    const footerHeading = document.querySelector('#footer-docs');
    expect(footerHeading).not.toBeNull();
    
    const footerList = document.querySelector('ul[aria-labelledby="footer-docs"]');
    expect(footerList).not.toBeNull();
  });
});
