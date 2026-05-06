#!/usr/bin/env node

import { startServer } from './server.js';

const apiKey = process.env.ARCWALL_API_KEY;

if (!apiKey) {
  console.error('Error: ARCWALL_API_KEY environment variable is required.');
  console.error('Get your free API key at arcwall.io');
  console.error('');
  console.error('Add to your MCP config:');
  console.error('{');
  console.error('  "mcpServers": {');
  console.error('    "arcwall": {');
  console.error('      "command": "npx",');
  console.error('      "args": ["@arcwall/mcp-server"],');
  console.error('      "env": { "ARCWALL_API_KEY": "your-key-here" }');
  console.error('    }');
  console.error('  }');
  console.error('}');
  process.exit(1);
}

startServer(apiKey).catch(error => {
  console.error('Failed to start Arcwall MCP server:', error);
  process.exit(1);
});
