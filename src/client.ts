import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://arcwall-production.up.railway.app';

export class ArcwallClient {
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }

  async post(endpoint: string, body: any): Promise<any> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(error.error || `Arcwall API error: ${response.status}`);
    }
    return response.json();
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: { 'x-api-key': this.apiKey }
    });
    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(error.error || `Arcwall API error: ${response.status}`);
    }
    return response.json();
  }

  readWorkspace(
    dirPath: string,
    extensions: string[],
    maxFiles: number = 50,
    maxBytes: number = 150000
  ): string {
    const results: string[] = [];
    let totalBytes = 0;
    let fileCount = 0;

    const SKIP_DIRS = new Set([
      'node_modules', '.git', 'dist', 'build',
      'vendor', '.next', 'coverage', '__pycache__',
      '.cache', 'tmp', 'temp', 'logs'
    ]);

    const walk = (dir: string, depth: number = 0): void => {
      if (depth > 5 || fileCount >= maxFiles) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch(e) { return; }

      for (const entry of entries) {
        if (fileCount >= maxFiles) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name) &&
              !entry.name.startsWith('.')) {
            walk(fullPath, depth + 1);
          }
          continue;
        }

        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        const baseName = entry.name.toLowerCase();

        const matches = extensions.some(e => {
          if (e.startsWith('.')) return ext === e;
          return baseName === e || baseName.includes(e);
        });

        if (!matches) continue;

        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 100000) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          if (totalBytes + content.length > maxBytes) return;
          results.push(`FILE: ${fullPath}\n${content}\n---`);
          totalBytes += content.length;
          fileCount++;
        } catch(e) {}
      }
    };

    walk(dirPath);

    if (results.length === 0) {
      return `No matching files found in ${dirPath}. ` +
        `Searched for: ${extensions.join(', ')}`;
    }

    return [
      `Scanned ${results.length} files in ${dirPath}`,
      '---',
      ...results
    ].join('\n');
  }

  readSpecificFiles(dirPath: string, fileNames: string[]): string {
    const results: string[] = [];
    for (const fileName of fileNames) {
      const filePath = path.join(dirPath, fileName);
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          results.push(`FILE: ${filePath}\n${content}\n---`);
        }
      } catch(e) {}
    }
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')
          && entry.name !== 'node_modules') {
          const subDir = path.join(dirPath, entry.name);
          for (const fileName of fileNames) {
            const filePath = path.join(subDir, fileName);
            try {
              if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                results.push(`FILE: ${filePath}\n${content}\n---`);
              }
            } catch(e) {}
          }
        }
      }
    } catch(e) {}
    if (results.length === 0) {
      return `No files found matching: ${fileNames.join(', ')} in ${dirPath}`;
    }
    return results.join('\n');
  }
}

export interface Finding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  remediation: string;
  component: string;
}

export function parseFindings(analysis: string): Finding[] {
  const findings: Finding[] = [];
  const lines = analysis.split('\n');
  let current: Partial<Finding> | null = null;

  for (const line of lines) {
    const match = line.match(
      /\*\*\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s+(.+?)\s*[-—]\s*(.+?)\*\*/
    );
    if (match) {
      if (current && current.title) findings.push(current as Finding);
      current = {
        severity: match[1] as Finding['severity'],
        category: match[2].trim(),
        title: match[3].trim(),
        description: '',
        remediation: '',
        component: ''
      };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Description:'))
        current.description = trimmed.replace('Description:', '').trim();
      else if (trimmed.startsWith('Remediation:'))
        current.remediation = trimmed.replace('Remediation:', '').trim();
      else if (trimmed.startsWith('Component:'))
        current.component = trimmed.replace('Component:', '').trim();
    }
  }
  if (current && current.title) findings.push(current as Finding);
  return findings;
}

export function severityIcon(severity: string): string {
  return ({ CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵' } as Record<string, string>)[severity] || '⚪';
}

export function formatFindings(
  findings: Finding[],
  title: string,
  repoName: string,
  shareUrl?: string
): string {
  const critical = findings.filter(f => f.severity === 'CRITICAL').length;
  const high = findings.filter(f => f.severity === 'HIGH').length;
  const medium = findings.filter(f => f.severity === 'MEDIUM').length;
  const low = findings.filter(f => f.severity === 'LOW').length;

  let output = `${title} — ${repoName}\n${'━'.repeat(50)}\n`;

  if (findings.length === 0) {
    output += `✅ No issues found\n`;
  } else {
    output += `${findings.length} findings: `;
    if (critical) output += `${critical} critical `;
    if (high) output += `${high} high `;
    if (medium) output += `${medium} medium `;
    if (low) output += `${low} low`;
    output += '\n\n';

    const priority = [
      ...findings.filter(f => f.severity === 'CRITICAL'),
      ...findings.filter(f => f.severity === 'HIGH'),
      ...findings.filter(f => f.severity === 'MEDIUM').slice(0, 3),
      ...findings.filter(f => f.severity === 'LOW').slice(0, 2)
    ];

    for (const f of priority) {
      output += `${severityIcon(f.severity)} ${f.severity} — ${f.title}\n`;
      if (f.component) output += `  File: ${f.component}\n`;
      if (f.remediation) {
        output += `  Fix: ${f.remediation.slice(0, 120)}${f.remediation.length > 120 ? '...' : ''}\n`;
      }
      output += '\n';
    }
    if (findings.length > priority.length) {
      output += `...and ${findings.length - priority.length} more findings\n\n`;
    }
  }
  if (shareUrl) output += `📊 Full report: ${shareUrl}\n`;
  return output;
}
