import { ArcwallClient } from '../client.js';
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

  const result = await client.post('/api/build-threat-model', {
    repoSummary: content,
    repoName,
    framework: 'stride'
  });

  if (!result.success) {
    return {
      content: [{
        type: 'text',
        text: `❌ Threat model failed: ${result.error || 'Unknown error'}`
      }],
      isError: true
    };
  }

  let output = `🏗️ Arcwall STRIDE Threat Model — ${repoName}\n`;
  output += `${'━'.repeat(50)}\n\n`;
  output += result.threatModel || 'No threat model generated';
  output += '\n\n';

  if (result.shareUrl) {
    output += `${'━'.repeat(50)}\n`;
    output += `📊 Full report: ${result.shareUrl}\n`;
    output += `Security lead has been notified for review.\n`;
  }

  return {
    content: [{ type: 'text', text: output }]
  };
}
