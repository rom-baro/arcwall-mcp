import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ArcwallClient } from './client.js';
import { scanSecretsHandler } from './tools/scanSecrets.js';
import { scanMCPHandler } from './tools/scanMCP.js';
import { scanAgentInstructionsHandler } from './tools/scanAgentInstructions.js';
import { threatModelHandler } from './tools/threatModel.js';
import { checkPromptHandler } from './tools/checkPrompt.js';
import { preCommitHandler } from './tools/preCommit.js';
import { scanDependenciesHandler } from './tools/scanDependencies.js';

export async function startServer(apiKey: string): Promise<void> {
  const client = new ArcwallClient(apiKey);
  const cwd = process.cwd();

  const server = new Server(
    { name: 'arcwall-security', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'arcwall_scan_secrets',
        description: 'Scan workspace for hardcoded API keys, passwords, private keys, tokens, and credentials. Run before committing or deploying.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory to scan. Defaults to current directory.' }
          }
        }
      },
      {
        name: 'arcwall_scan_mcp',
        description: 'Scan MCP server configurations for prompt injection, excessive permissions, and unverified server origins. Scans .cursor/mcp.json, .vscode/mcp.json, .claude/mcp.json and other MCP config files.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory to search for MCP configs.' }
          }
        }
      },
      {
        name: 'arcwall_scan_agent_instructions',
        description: 'Scan agent instruction files for security vulnerabilities. Covers CLAUDE.md, .cursorrules, .windsurfrules, AGENTS.md and other formats. Detects prompt injection, sensitive data, and missing guardrails.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory to search for agent instruction files.' }
          }
        }
      },
      {
        name: 'arcwall_threat_model',
        description: 'Generate a STRIDE threat model for the current codebase. Identifies trust boundary gaps, authorization issues, data flow exposures, and architectural risks. Results saved to Arcwall dashboard.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory to analyze.' },
            repoName: { type: 'string', description: 'Repository or system name.' },
            mode: {
              type: 'string',
              enum: ['code', 'design'],
              description: 'code: scan codebase. design: analyze architecture.'
            }
          }
        }
      },
      {
        name: 'arcwall_check_prompt',
        description: 'Test a system prompt for injection vulnerabilities, jailbreak susceptibility, missing guardrails, and excessive agency. Include test messages to check multi-turn vulnerabilities.',
        inputSchema: {
          type: 'object',
          properties: {
            systemPrompt: { type: 'string', description: 'The system prompt to test.' },
            testMessages: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional test messages to check multi-turn vulnerabilities.'
            }
          },
          required: ['systemPrompt']
        }
      },
      {
        name: 'arcwall_pre_commit',
        description: 'Security check before committing. Scans staged files for secrets and checks MCP configs. Returns CLEAR TO COMMIT or BLOCKED with issues to fix.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Repository directory.' }
          }
        }
      },
      {
        name: 'arcwall_scan_dependencies',
        description: 'Check dependencies for known CVEs. Scans package.json for vulnerable packages with safe version recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Project directory to scan.' }
          }
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch(name) {
        case 'arcwall_scan_secrets':
          return await scanSecretsHandler(client, args, cwd);
        case 'arcwall_scan_mcp':
          return await scanMCPHandler(client, args, cwd);
        case 'arcwall_scan_agent_instructions':
          return await scanAgentInstructionsHandler(client, args, cwd);
        case 'arcwall_threat_model':
          return await threatModelHandler(client, args, cwd);
        case 'arcwall_check_prompt':
          return await checkPromptHandler(client, args, cwd);
        case 'arcwall_pre_commit':
          return await preCommitHandler(client, args, cwd);
        case 'arcwall_scan_dependencies':
          return await scanDependenciesHandler(client, args, cwd);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch(e: any) {
      return {
        content: [{
          type: 'text',
          text: `Arcwall error: ${e.message}\n\nCheck your API key at arcwall.io/app.html`
        }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Arcwall MCP server running — ready for connections');
}
