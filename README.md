# @arcwall/mcp-server

Security scanning for Claude Code, Cursor, Windsurf,
and any MCP-compatible AI coding tool.

## Setup

1. Get your free API key at https://arcwall.io

2. Add to your MCP config:

Claude Code (~/.claude/mcp.json):
```json
{
  "mcpServers": {
    "arcwall": {
      "command": "npx",
      "args": ["@arcwall/mcp-server"],
      "env": { "ARCWALL_API_KEY": "your-key-here" }
    }
  }
}
```

Cursor (.cursor/mcp.json): Same config.
Windsurf: Add via MCP settings panel.

3. Restart your AI tool — Arcwall is ready.

## Tools

- `arcwall_scan_secrets` — hardcoded credentials
- `arcwall_scan_mcp` — MCP config vulnerabilities
- `arcwall_scan_agent_instructions` — CLAUDE.md, .cursorrules security
- `arcwall_threat_model` — STRIDE analysis
- `arcwall_check_prompt` — prompt injection testing
- `arcwall_pre_commit` — pre-commit security check
- `arcwall_scan_dependencies` — known CVEs in packages

## Usage

Ask your AI assistant:
- "Scan this repo for secrets"
- "Check my MCP configs for vulnerabilities"
- "Is my CLAUDE.md safe?"
- "Generate a threat model for this project"
- "Run a security check before I commit"
- "Are there vulnerable packages in this project?"

## Links

- Website: https://arcwall.io
- Dashboard: https://arcwall.io/app.html
- Docs: https://arcwall.io/docs.html
- GitHub: https://github.com/rom-baro/arcwall-mcp
- Support: hello@arcwall.io
