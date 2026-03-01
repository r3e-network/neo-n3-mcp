const fs = require('fs');
const path = require('path');

const VALID_ADDRESS = 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr';
const VALID_WIF = 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8';
const VALID_TXID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const VALID_SCRIPT_HASH = '0xf81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e';

const replacements = [
  { regex: /NMockAddress123/g, repl: VALID_ADDRESS },
  { regex: /NSenderAddress123/g, repl: VALID_ADDRESS },
  { regex: /NRecipientAddress123/g, repl: VALID_ADDRESS },
  { regex: /NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ/g, repl: VALID_ADDRESS },
  { regex: /NTest1Address/g, repl: VALID_ADDRESS },
  { regex: /NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj/g, repl: VALID_ADDRESS },
  { regex: /NMockConsensusAddress/g, repl: VALID_ADDRESS },
  { regex: /NMockSenderAddress/g, repl: VALID_ADDRESS },
  { regex: /L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k/g, repl: VALID_WIF },
  { regex: /'0x123'/g, repl: `'${VALID_TXID}'` },
  { regex: /'0x456'/g, repl: `'${VALID_TXID}'` },
  { regex: /'0xabc123'/g, repl: `'${VALID_TXID}'` },
  { regex: /'0xabc123def456'/g, repl: `'${VALID_TXID}'` }
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { regex, repl } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, repl);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir(path.join(__dirname, 'tests'));
