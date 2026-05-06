import { ArcwallClient } from '../client.js';
import * as fs from 'fs';
import * as path from 'path';

const VULNERABLE_PACKAGES: Record<string, {
  safe: string; cve: string; severity: string; issue: string;
}> = {
  'lodash': { safe: '4.17.21', cve: 'CVE-2021-23337', severity: 'HIGH', issue: 'Prototype pollution' },
  'axios': { safe: '1.6.0', cve: 'CVE-2023-45857', severity: 'HIGH', issue: 'CSRF vulnerability' },
  'express': { safe: '4.19.0', cve: 'CVE-2024-29041', severity: 'MEDIUM', issue: 'Open redirect' },
  'jsonwebtoken': { safe: '9.0.0', cve: 'CVE-2022-23529', severity: 'HIGH', issue: 'Remote code execution' },
  'node-fetch': { safe: '3.3.2', cve: 'CVE-2022-0235', severity: 'HIGH', issue: 'Exposure of sensitive info' },
  'minimist': { safe: '1.2.6', cve: 'CVE-2021-44906', severity: 'CRITICAL', issue: 'Prototype pollution' },
  'path-parse': { safe: '1.0.7', cve: 'CVE-2021-23343', severity: 'HIGH', issue: 'ReDoS' },
  'glob-parent': { safe: '5.1.2', cve: 'CVE-2020-28469', severity: 'HIGH', issue: 'ReDoS' },
  'ws': { safe: '8.17.1', cve: 'CVE-2024-37890', severity: 'HIGH', issue: 'DoS via headers' },
  'semver': { safe: '7.5.4', cve: 'CVE-2022-25883', severity: 'HIGH', issue: 'ReDoS' },
  'tough-cookie': { safe: '4.1.3', cve: 'CVE-2023-26136', severity: 'CRITICAL', issue: 'Prototype pollution' },
  'word-wrap': { safe: '1.2.4', cve: 'CVE-2023-26115', severity: 'HIGH', issue: 'ReDoS' },
  'fast-xml-parser': { safe: '4.2.5', cve: 'CVE-2023-34104', severity: 'HIGH', issue: 'Prototype pollution' },
  'xml2js': { safe: '0.5.0', cve: 'CVE-2023-0842', severity: 'MEDIUM', issue: 'Prototype pollution' },
  'multer': { safe: '1.4.5-lts.1', cve: 'CVE-2022-24434', severity: 'HIGH', issue: 'DoS via large files' },
};

export async function scanDependenciesHandler(
  _client: ArcwallClient, args: any, cwd: string
): Promise<any> {
  const scanPath = args?.path || cwd;
  const findings: Array<{ package: string; safe: string; cve: string; severity: string; issue: string; file: string }> = [];

  const pkgPath = path.join(scanPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name] of Object.entries(allDeps)) {
        const vuln = VULNERABLE_PACKAGES[name];
        if (!vuln) continue;
        findings.push({ package: name, ...vuln, file: 'package.json' });
      }
    } catch(e) {}
  }

  let output = `📦 Arcwall Dependency Scan — ${path.basename(scanPath)}\n${'━'.repeat(50)}\n`;

  if (findings.length === 0) {
    output += `✅ No known vulnerable dependencies detected\n`;
    output += `Note: Run npm audit for a complete vulnerability scan.\n`;
  } else {
    const critical = findings.filter(f => f.severity === 'CRITICAL').length;
    const high = findings.filter(f => f.severity === 'HIGH').length;
    output += `⚠️ ${findings.length} vulnerable packages: ${critical} critical, ${high} high\n\n`;

    for (const f of findings) {
      const icon = f.severity === 'CRITICAL' ? '🔴' : '🟠';
      output += `${icon} ${f.severity} — ${f.package}\n`;
      output += `  Issue: ${f.issue}\n`;
      output += `  CVE: ${f.cve}\n`;
      output += `  Fix: Update to ${f.package}@${f.safe}\n\n`;
    }
    output += `Run: npm audit fix --force\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}
