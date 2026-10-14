/**
 * WebMCP is experimental. Chromium needs --enable-features=WebMCP, so this test
 * launches its own browser and leaves the rest of the suite on the normal launch.
 */
import { chromium, expect } from '@playwright/test';
import { defined, test } from '../fixtures';

const PAGE = `<!doctype html>
<script>
  const modelContext = document.modelContext || navigator.modelContext;
  modelContext.registerTool({
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: {
      type: 'object',
      properties: { a: { type: 'number' }, b: { type: 'number' } },
      required: ['a', 'b'],
    },
    async execute(input) {
      return { content: [{ type: 'text', text: String(input.a + input.b) }] };
    },
  });
</script>`;

/** Chromium keeps the first --enable-features flag. Playwright adds its own unless this is set. */
async function launchWebMCPBrowser() {
    const previous = process.env.PLAYWRIGHT_LEGACY_SCREENSHOT;
    process.env.PLAYWRIGHT_LEGACY_SCREENSHOT = '1';
    try {
        return await chromium.launch({ args: ['--enable-features=WebMCP'] });
    } finally {
        if (previous === undefined) delete process.env.PLAYWRIGHT_LEGACY_SCREENSHOT;
        else process.env.PLAYWRIGHT_LEGACY_SCREENSHOT = previous;
    }
}

test('calls a tool the page registers with WebMCP', async ({ browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'WebMCP in this example uses the Chromium launch flag');
    const url = defined(baseURL, 'baseURL is set by the config');

    // The API is missing on about:blank, so open the app before replacing the document.
    const browser = await launchWebMCPBrowser();

    try {
        const page = await browser.newPage();
        await page.goto(url);
        await page.setContent(PAGE);
        const tools = await page.webmcp.tools();
        expect(tools.map((tool) => tool.name)).toContain('add');
        expect(await page.webmcp.callTool('add', { a: 2, b: 40 })).toEqual({
            content: [{ type: 'text', text: '42' }],
        });
    } finally {
        await browser.close();
    }
});
