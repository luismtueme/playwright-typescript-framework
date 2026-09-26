# Test plans

Markdown test plans written by Playwright's planner agent (`.claude/agents/playwright-test-planner.md`),
which the generator agent turns into specs under `tests/`.

## Using the agents (Claude Code)

1. Start the demo app, or set `BASE_URL`: `npm run demo`.
2. In Claude Code, ask the planner to explore a feature, for example:
   _"Use the playwright-test-planner agent to plan tests for the items page, seeded from tests/seed.spec.ts."_
   It saves a plan here, such as `specs/items.md`.
3. Ask the generator to implement one scenario from the plan. It drives a real browser through the
   Playwright test MCP server (`.mcp.json`) and writes the spec.
4. If a test fails later, the healer agent debugs and fixes it.

The agents follow this repository's conventions from [AGENTS.md](../AGENTS.md): fixtures, page objects,
roles, data cleanup and tags. Review generated tests like any other PR; they go through the same CI gates.

On Windows, Claude Code may need the MCP server started through `cmd`: in `.mcp.json`, use
`"command": "cmd", "args": ["/c", "npx", "playwright", "run-test-mcp-server"]`.
