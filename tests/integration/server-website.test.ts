import { jest } from '@jest/globals';
import { NeoService } from '../../src/services/neo-service';
import { ContractService } from '../../src/contracts/contract-service';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

/**
 * Integration tests for the Neo N3 MCP Server and Website
 * 
 * These tests verify that the server and website work together correctly
 */

describe('Server-Website Integration Tests', () => {
  let neoService: NeoService;
  let contractService: ContractService;
  let dom: JSDOM;
  
  beforeAll(() => {
    // Initialize services
    neoService = new NeoService('https://testnet1.neo.coz.io:443');
    contractService = new ContractService('https://testnet1.neo.coz.io:443');
    
    // Load the website HTML
    const htmlPath = path.join(__dirname, '../../website/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    dom = new JSDOM(html);
    
    // Mock fetch for API calls
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.toString().includes('/api/blockchain/height')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ height: 12345 }),
        });
      }
      if (url.toString().includes('/api/contracts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ contracts: ['NeoFS', 'NeoBurger', 'Flamingo'] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });
  
  afterAll(() => {
    // Clean up
    jest.restoreAllMocks();
  });
  
  test('website should have correct title', () => {
    const title = dom.window.document.title;
    expect(title).toBe('Neo N3 MCP Server | R3E Network');
  });
  
  test('website should have navigation links to all pages', () => {
    const navLinks = dom.window.document.querySelectorAll('nav a');
    const linkHrefs = Array.from(navLinks).map(link => link.getAttribute('href'));
    
    expect(linkHrefs).toContain('index.html');
    expect(linkHrefs).toContain('documentation.html');
    expect(linkHrefs).toContain('user-guide.html');
    expect(linkHrefs).toContain('block-explorer.html');
    expect(linkHrefs).toContain('api-playground.html');
    expect(linkHrefs).toContain('chat.html');
  });
  
  test('website should have links to famous contracts', () => {
    const contractLinks = dom.window.document.querySelectorAll('.contract-card a');
    const linkHrefs = Array.from(contractLinks).map(link => link.getAttribute('href'));
    
    expect(linkHrefs).toContain('documentation.html#neofs');
    expect(linkHrefs).toContain('documentation.html#neoburger');
    expect(linkHrefs).toContain('documentation.html#flamingo');
  });
  
  test('NeoService should be able to get blockchain height', async () => {
    // Mock the RPC client
    const mockRpcClient = {
      getBlockCount: jest.fn().mockResolvedValue(12345),
    };
    
    // @ts-ignore - Mock private property
    neoService.rpcClient = mockRpcClient;
    
    const height = await neoService.getBlockchainHeight();
    expect(height).toBe(12345);
    expect(mockRpcClient.getBlockCount).toHaveBeenCalled();
  });
  
  test('ContractService should be able to list supported contracts', () => {
    const contracts = contractService.listSupportedContracts();
    expect(contracts.length).toBeGreaterThan(0);
    
    // Check if NeoFS is in the list
    const neofs = contracts.find(c => c.name === 'NeoFS');
    expect(neofs).toBeDefined();
    expect(neofs?.description).toBeTruthy();
  });
  
  test('website should have code examples that match server API', () => {
    const codeBlocks = dom.window.document.querySelectorAll('pre code');
    const codeTexts = Array.from(codeBlocks).map(block => block.textContent);
    
    // Check if any code block contains the MCP server configuration
    const hasMcpConfig = codeTexts.some(text => 
      text?.includes('"mcpServers"') && 
      text?.includes('"neo-n3"') && 
      text?.includes('@r3e/neo-n3-mcp')
    );
    
    expect(hasMcpConfig).toBe(true);
  });
  
  test('website should have accessibility features', () => {
    // Check for skip to content link
    const skipLink = dom.window.document.querySelector('.skip-to-content');
    expect(skipLink).not.toBeNull();
    
    // Check for ARIA attributes
    const ariaElements = dom.window.document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
    expect(ariaElements.length).toBeGreaterThan(0);
    
    // Check for main content ID
    const mainContent = dom.window.document.querySelector('#main-content');
    expect(mainContent).not.toBeNull();
  });
  
  test('website should have responsive design meta tag', () => {
    const viewportMeta = dom.window.document.querySelector('meta[name="viewport"]');
    expect(viewportMeta).not.toBeNull();
    expect(viewportMeta?.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
  });
});
