import { ArcwallClient, parseFindings } from '../client.js';
import * as path from 'path';

export async function threatModelHandler(
  client: ArcwallClient, args: any, cwd: string
): Promise<any> {
  const scanPath = args?.path || cwd;
  const repoName = args?.repoName || path.basename(scanPath);
  const mode = args?.mode || 'code';

  const content = client.readWorkspace(scanPath, [
    '.ts', '.js', '.tsx', '.jsx', '.py', '.go',
    '.java', '.rb', '.cs', '.php', '.rs',
    '.yaml', '.yml', '.json', '.tf', '.env'
  ], 40, 120000);

  const endpoint = mode === 'design'
    ? '/api/design-threat-model'
    : '/api/build-threat-model';

  const result = await client.post(endpoint, {
    repoSummary: content, repoName, commitSha: 'mcp-scan'
  });

  const findings = parseFindings(result.analysis || '');
  const critical = findings.filter(f => f.severity === 'CRITICAL').length;
  const high = findings.filter(f => f.severity === 'HIGH').length;

  let output = `🏗️ Arcwall STRIDE Threat Model — ${repoName}\n${'━'.repeat(50)}\n`;
  output += `Mode: ${mode === 'design' ? 'Design' : 'Code'} analysis\n`;
  output += `${findings.length} threats: ${critical} critical, ${high} high\n\n`;

  if (findings.length === 0) {
    output += `✅ No significant threats identified\n`;
  } else {
    const priority = [
      ...findings.filter(f => f.severity === 'CRITICAL'),
      ...findings.filter(f => f.severity === 'HIGH').slice(0, 5)
    ];
    for (const f of priority) {
      output += `🔴 ${f.severity} — ${f.title}\n`;
      if (f.description) output += `  ${f.description.slice(0, 150)}\n`;
      if (f.remediation) output += `  Fix: ${f.remediation.slice(0, 100)}\n`;
      output += '\n';
    }
    if (findings.length > priority.length) {
      output += `...and ${findings.length - priority.length} more threats\n\n`;
    }
  }
  if (result.shareUrl) {
    output += `📊 Full threat model: ${result.shareUrl}\n`;
    output += `Security lead has been notified for review.\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}
