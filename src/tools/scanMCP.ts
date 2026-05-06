import { ArcwallClient, parseFindings, formatFindings } from '../client.js';
import * as path from 'path';

const MCP_FILES = [
  '.cursor/mcp.json', '.vscode/mcp.json',
  '.claude/mcp.json', '.mcp.json', 'mcp.json',
  '.cursor/settings.json', '.vscode/settings.json'
];

export async function scanMCPHandler(
  client: ArcwallClient, args: any, cwd: string
): Promise<any> {
  const scanPath = args?.path || cwd;
  const repoName = path.basename(scanPath);
  const content = client.readSpecificFiles(scanPath, MCP_FILES);

  if (content.startsWith('No files found')) {
    return {
      content: [{
        type: 'text',
        text: `🔌 Arcwall MCP Scan — ${repoName}\n${'━'.repeat(50)}\nNo MCP configuration files found.\nSearched for: ${MCP_FILES.join(', ')}`
      }]
    };
  }

  const result = await client.post('/api/scan-mcp', {
    repoSummary: content, repoName
  });
  const findings = parseFindings(result.analysis || '');
  return {
    content: [{
      type: 'text',
      text: formatFindings(findings, '🔌 Arcwall MCP Security Scan', repoName, result.shareUrl)
    }]
  };
}
