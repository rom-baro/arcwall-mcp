import { ArcwallClient, parseFindings, formatFindings } from '../client.js';
import * as path from 'path';

export async function scanSecretsHandler(
  client: ArcwallClient, args: any, cwd: string
): Promise<any> {
  const scanPath = args?.path || cwd;
  const repoName = path.basename(scanPath);
  const content = client.readWorkspace(scanPath, [
    '.ts', '.js', '.tsx', '.jsx', '.py', '.go',
    '.java', '.rb', '.cs', '.php', '.rs', '.swift',
    '.env', '.yaml', '.yml', '.json', '.sh', '.tf',
    '.toml', '.ini', '.cfg', '.conf', '.properties'
  ]);
  const result = await client.post('/api/scan-secrets', {
    repoSummary: content, repoName
  });
  const findings = parseFindings(result.analysis || '');
  return {
    content: [{
      type: 'text',
      text: formatFindings(findings, '🔑 Arcwall Secrets Scan', repoName, result.shareUrl)
    }]
  };
}
