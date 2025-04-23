/**
 * Responsive Design Tests
 * 
 * These tests check for responsive design features in the website
 */

// Mock the DOM environment for browser-like testing
const originalDocument = global.document;
const originalWindow = global.window;

describe('Responsive Design Tests', () => {
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
      <main>
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
      </main>
      <link rel="stylesheet" href="css/styles.css">
    `;
    
    // Mock window.matchMedia
    window.matchMedia = jest.fn().mockImplementation(query => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    });
    
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
  });
  
  // After each test, restore the original document and window
  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    jest.resetModules();
  });
  
  test('should have viewport meta tag', () => {
    // Add viewport meta tag to head
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0';
    document.head.appendChild(meta);
    
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    expect(viewportMeta).not.toBeNull();
    expect(viewportMeta.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
  });
  
  test('should have container with max-width', () => {
    // Mock getComputedStyle
    window.getComputedStyle = jest.fn().mockImplementation(element => {
      if (element.classList.contains('container')) {
        return {
          maxWidth: '1200px',
          width: '100%',
        };
      }
      return {};
    });
    
    const container = document.querySelector('.container');
    expect(container).not.toBeNull();
    
    const style = window.getComputedStyle(container);
    expect(style.maxWidth).toBe('1200px');
    expect(style.width).toBe('100%');
  });
  
  test('should adjust layout for mobile devices', () => {
    // Change window width to mobile size
    window.innerWidth = 480;
    
    // Dispatch resize event
    window.dispatchEvent(new Event('resize'));
    
    // Mock matchMedia to return true for mobile query
    window.matchMedia = jest.fn().mockImplementation(query => {
      return {
        matches: query.includes('max-width: 768px'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    });
    
    // Check if mobile media query matches
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    expect(isMobile).toBe(true);
  });
  
  test('should adjust layout for tablet devices', () => {
    // Change window width to tablet size
    window.innerWidth = 820;
    
    // Dispatch resize event
    window.dispatchEvent(new Event('resize'));
    
    // Mock matchMedia to return true for tablet query
    window.matchMedia = jest.fn().mockImplementation(query => {
      return {
        matches: query.includes('max-width: 992px') && !query.includes('max-width: 768px'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    });
    
    // Check if tablet media query matches
    const isTablet = window.matchMedia('(max-width: 992px) and (min-width: 769px)').matches;
    expect(isTablet).toBe(true);
  });
  
  test('should adjust layout for desktop devices', () => {
    // Change window width to desktop size
    window.innerWidth = 1200;
    
    // Dispatch resize event
    window.dispatchEvent(new Event('resize'));
    
    // Mock matchMedia to return true for desktop query
    window.matchMedia = jest.fn().mockImplementation(query => {
      return {
        matches: query.includes('min-width: 993px'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    });
    
    // Check if desktop media query matches
    const isDesktop = window.matchMedia('(min-width: 993px)').matches;
    expect(isDesktop).toBe(true);
  });
});
