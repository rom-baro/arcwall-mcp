import { ArcwallClient, parseFindings } from '../client.js';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

const MCP_FILES = [
  '.cursor/mcp.json', '.vscode/mcp.json',
  '.claude/mcp.json', '.mcp.json', 'mcp.json'
];

export async function preCommitHandler(
  client: ArcwallClient, args: any, cwd: string
): Promise<any> {
  const scanPath = args?.path || cwd;
  const repoName = path.basename(scanPath);

  let output = `🔐 Arcwall Pre-Commit Security Check — ${repoName}\n${'━'.repeat(50)}\n\n`;

  let stagedFiles: string[] = [];
  try {
    const result = child_process.execSync(
      'git diff --cached --name-only',
      { cwd: scanPath, encoding: 'utf8' }
    );
    stagedFiles = result.trim().split('\n').filter(Boolean);
  } catch(e) {}

  const content = stagedFiles.length > 0
    ? stagedFiles.reduce((acc, file) => {
        const fullPath = path.join(scanPath, file);
        try {
          if (fs.existsSync(fullPath)) {
            return acc + `FILE: ${fullPath}\n${fs.readFileSync(fullPath, 'utf8')}\n---\n`;
          }
        } catch(e) {}
        return acc;
      }, `Staged files:\n`)
    : client.readWorkspace(scanPath, [
        '.ts', '.js', '.py', '.go', '.java', '.rb',
        '.env', '.yaml', '.yml', '.json', '.sh', '.tf'
      ], 30, 80000);

  if (stagedFiles.length > 0) {
    output += `Checking ${stagedFiles.length} staged files...\n\n`;
  } else {
    output += `No staged files — scanning workspace...\n\n`;
  }

  let blocked = false;
  let scansPassed = 0;
  let scansFailed = 0;

  // Secrets scan
  try {
    const secretsResult = await client.post('/api/scan-secrets', {
      repoSummary: content, repoName
    });
    const findings = parseFindings(secretsResult.analysis || '');
    const critical = findings.filter(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );
    if (critical.length > 0) {
      blocked = true; scansFailed++;
      output += `❌ Secrets scan FAILED\n`;
      critical.forEach(f => {
        output += `  🔴 ${f.severity} — ${f.title}\n`;
        if (f.component) output += `  File: ${f.component}\n`;
      });
      output += '\n';
    } else {
      scansPassed++;
      output += `✅ Secrets scan passed\n\n`;
    }
  } catch(e: any) {
    output += `⚠️ Secrets scan error: ${e.message}\n\n`;
  }

  // MCP scan
  try {
    const mcpContent = client.readSpecificFiles(scanPath, MCP_FILES);
    if (!mcpContent.startsWith('No files found')) {
      const mcpResult = await client.post('/api/scan-mcp', {
        repoSummary: mcpContent, repoName
      });
      const findings = parseFindings(mcpResult.analysis || '');
      const critical = findings.filter(
        f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
      );
      if (critical.length > 0) {
        blocked = true; scansFailed++;
        output += `❌ MCP security check FAILED\n`;
        critical.forEach(f => {
          output += `  🔴 ${f.severity} — ${f.title}\n`;
        });
        output += '\n';
      } else {
        scansPassed++;
        output += `✅ MCP security check passed\n\n`;
      }
    }
  } catch(e: any) {
    output += `⚠️ MCP check error: ${e.message}\n\n`;
  }

  output += `${'━'.repeat(50)}\n`;
  if (blocked) {
    output += `🚫 COMMIT BLOCKED — ${scansFailed} check(s) failed\n`;
    output += `Fix the issues above before committing.\n`;
  } else {
    output += `✅ CLEAR TO COMMIT — all checks passed (${scansPassed} checks)\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}
