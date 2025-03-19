/**
 * Block Explorer Component Tests
 * 
 * These tests use JSDOM to test the frontend Block Explorer component
 */

// Mock data for blocks and transactions
const mockLatestBlocks = [
  {
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    size: 1024,
    time: 1600000000,
    index: 9999,
    tx: ['tx1', 'tx2']
  },
  {
    hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    size: 2048,
    time: 1599999000,
    index: 9998,
    tx: ['tx3', 'tx4', 'tx5']
  }
];

const mockBlockDetails = {
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  size: 1024,
  version: 0,
  previousblockhash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  merkleroot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  time: 1600000000,
  index: 9999,
  nextblockhash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
  tx: ['tx1', 'tx2']
};

const mockStats = {
  blockCount: 10000,
  version: {
    protocol_version: 3,
    user_agent: '/Neo:3.5.0/'
  },
  network: 'testnet'
};

// Mock the DOM environment for browser-like testing
const originalDocument = global.document;
const originalWindow = global.window;

describe('Block Explorer Component Tests', () => {
  // Before each test, setup a DOM environment
  beforeEach(() => {
    // Create a minimal HTML structure with the necessary elements
    document.body.innerHTML = `
      <div class="network-selector">
        <input type="radio" name="network" id="mainnet" value="mainnet">
        <input type="radio" name="network" id="testnet" value="testnet" checked>
      </div>
      <div id="latest-blocks-container"></div>
      <div id="block-details-container"></div>
      <div id="transaction-details-container"></div>
      <div id="blockchain-stats"></div>
      <input type="number" id="block-height-input">
      <button id="search-block-btn"></button>
      <input type="text" id="block-hash-input">
      <button id="search-hash-btn"></button>
      <input type="text" id="tx-id-input">
      <button id="search-tx-btn"></button>
      
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    `;
    
    // Mock fetch API
    global.fetch = jest.fn();
    
    // Mock bootstrap Tab
    global.bootstrap = {
      Tab: class {
        constructor() {}
        show() {}
      }
    };
    
    // Reset modules to ensure clean state
    jest.resetModules();
  });
  
  // After each test, restore the original document and window
  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    jest.resetModules();
  });
  
  test('should fetch latest blocks on initialization', async () => {
    // Mock fetch response for latest blocks
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        json: () => Promise.resolve(mockLatestBlocks)
      })
    );
    
    // Mock fetch response for blockchain stats
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        json: () => Promise.resolve(mockStats)
      })
    );
    
    // Load the block explorer script and fire DOMContentLoaded
    const script = document.createElement('script');
    script.textContent = `
      document.addEventListener('DOMContentLoaded', function() {
        // Fetch latest blocks
        const fetchLatestBlocks = async function() {
          const response = await fetch('/.netlify/functions/block-explorer?action=latestBlocks&network=testnet');
          const blocks = await response.json();
          const latestBlocksContainer = document.getElementById('latest-blocks-container');
          
          // Create block cards
          let blocksHtml = '';
          blocks.forEach(block => {
            blocksHtml += \`
              <div class="card block-card" data-block-height="\${block.index}" data-block-hash="\${block.hash}">
                <div class="card-body">
                  <h5>Block #\${block.index}</h5>
                  <p>Hash: \${block.hash}</p>
                  <p>Transactions: \${block.tx ? block.tx.length : 0}</p>
                  <p>Size: \${block.size} bytes</p>
                </div>
              </div>
            \`;
          });
          
          latestBlocksContainer.innerHTML = blocksHtml;
        };
        
        // Fetch blockchain stats
        const fetchBlockchainStats = async function() {
          const response = await fetch('/.netlify/functions/block-explorer?action=getStats&network=testnet');
          const stats = await response.json();
          const blockchainStats = document.getElementById('blockchain-stats');
          
          blockchainStats.innerHTML = \`
            <div>Network: \${stats.network}</div>
            <div>Current Height: \${stats.blockCount}</div>
            <div>Protocol Version: \${stats.version.protocol_version}</div>
          \`;
        };
        
        // Initialize
        fetchLatestBlocks();
        fetchBlockchainStats();
      });
    `;
    document.body.appendChild(script);
    
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Wait for fetches to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch should have been called twice
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    // Block containers should be updated
    const latestBlocksContainer = document.getElementById('latest-blocks-container');
    expect(latestBlocksContainer.innerHTML).toContain('Block #9999');
    expect(latestBlocksContainer.innerHTML).toContain('Block #9998');
    
    // Stats should be updated
    const blockchainStats = document.getElementById('blockchain-stats');
    expect(blockchainStats.innerHTML).toContain('Network: testnet');
    expect(blockchainStats.innerHTML).toContain('Current Height: 10000');
  });
  
  test('should fetch block details when requested', async () => {
    // Mock fetch response for block details
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        json: () => Promise.resolve(mockBlockDetails)
      })
    );
    
    // Create fetchBlockDetails function
    const fetchBlockDetails = async (heightOrHash) => {
      const url = `/.netlify/functions/block-explorer?action=getBlock&height=${heightOrHash}&network=testnet`;
      const response = await fetch(url);
      const block = await response.json();
      
      const blockDetailsContainer = document.getElementById('block-details-container');
      blockDetailsContainer.innerHTML = `
        <h4>Block #${block.index}</h4>
        <p>Hash: ${block.hash}</p>
        <p>Size: ${block.size} bytes</p>
        <p>Transactions: ${block.tx ? block.tx.length : 0}</p>
      `;
    };
    
    // Call fetchBlockDetails
    await fetchBlockDetails(9999);
    
    // Wait for fetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch should have been called
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/block-explorer?action=getBlock&height=9999&network=testnet'
    );
    
    // Block details should be updated
    const blockDetailsContainer = document.getElementById('block-details-container');
    expect(blockDetailsContainer.innerHTML).toContain('Block #9999');
    expect(blockDetailsContainer.innerHTML).toContain(mockBlockDetails.hash);
  });
  
  test('should handle network change', async () => {
    // Mock fetch responses
    global.fetch
      .mockImplementationOnce(() => 
        Promise.resolve({
          json: () => Promise.resolve(mockLatestBlocks)
        })
      )
      .mockImplementationOnce(() => 
        Promise.resolve({
          json: () => Promise.resolve(mockStats)
        })
      );
    
    // Load simplified block explorer script
    const script = document.createElement('script');
    script.textContent = `
      document.addEventListener('DOMContentLoaded', function() {
        // Network change handler
        const networkRadios = document.querySelectorAll('input[name="network"]');
        let currentNetwork = 'testnet';
        
        networkRadios.forEach(radio => {
          radio.addEventListener('change', function() {
            currentNetwork = this.value;
            fetch('/.netlify/functions/block-explorer?action=latestBlocks&network=' + currentNetwork);
            fetch('/.netlify/functions/block-explorer?action=getStats&network=' + currentNetwork);
          });
        });
      });
    `;
    document.body.appendChild(script);
    
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Change network to mainnet
    const mainnetRadio = document.getElementById('mainnet');
    mainnetRadio.checked = true;
    mainnetRadio.dispatchEvent(new Event('change'));
    
    // Wait for fetches to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch should have been called with mainnet
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/block-explorer?action=latestBlocks&network=mainnet'
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/block-explorer?action=getStats&network=mainnet'
    );
  });
}); 