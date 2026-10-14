/**
 * Playwright 1.64 library APIs that this suite can run without changing the demo app:
 * locator.within(), aria refs, request-context cookies, and shadow DOM in page.content().
 */
import { test, expect, defined } from '../fixtures';

const PAGE = `<!doctype html>
<main>
  <table>
    <tr><td>1</td><td>red</td><td>Apple</td></tr>
    <tr><td>2</td><td>yellow</td><td>Banana</td></tr>
    <tr><td>3</td><td>red</td><td>Cherry</td></tr>
  </table>
  <button>Save</button>
  <dialog open>
    <button>Save</button>
    <p id="saved"></p>
  </dialog>
  <div id="host"></div>
  <script>
    document.querySelector('dialog button').addEventListener('click', () => {
      document.getElementById('saved').textContent = 'saved';
    });
    document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML = '<p>inside shadow</p>';
  </script>
</main>`;

test.describe('Playwright 1.64 library', () => {
    test.beforeEach(async ({ page }) => {
        await page.setContent(PAGE);
    });

    test('locator.within() keeps a column inside each row', async ({ page }) => {
        // The third cell of every row, not the third cell in the table.
        const thirdColumn = page.getByRole('cell').nth(2).within(page.getByRole('row'));
        await expect(thirdColumn).toHaveText(['Apple', 'Banana', 'Cherry']);
    });

    test('locator.within() clicks the Save button inside the dialog', async ({ page }) => {
        const save = page.getByRole('button', { name: 'Save' });
        await expect(save).toHaveCount(2);
        await save.within(page.getByRole('dialog')).click();
        await expect(page.locator('#saved')).toHaveText('saved');
    });

    test('getByRef() uses the ref from an ai aria snapshot', async ({ page }) => {
        const snapshot = await page.getByRole('dialog').ariaSnapshot({ mode: 'ai' });
        const ref = defined(snapshot.match(/button "Save" \[ref=(e\d+)\]/)?.[1], `no Save ref in:\n${snapshot}`);
        await page.getByRef(ref).click();
        await expect(page.locator('#saved')).toHaveText('saved');
    });

    test('page.content() can include open shadow roots', async ({ page }) => {
        const plain = await page.content();
        const withShadow = await page.content({ includeShadow: true });
        expect(plain).not.toContain('shadowrootmode');
        expect(withShadow).toContain('<template shadowrootmode="open">');
        expect(withShadow).toContain('inside shadow');
    });

    test('the API request context stores and clears cookies', async ({ request, baseURL }) => {
        const url = defined(baseURL, 'baseURL is set by the config');
        await request.addCookies([{ name: 'session-id', value: '42', url }]);
        expect(await request.cookies(url)).toContainEqual(expect.objectContaining({ name: 'session-id', value: '42' }));
        await request.clearCookies({ name: 'session-id' });
        expect(await request.cookies(url)).not.toContainEqual(expect.objectContaining({ name: 'session-id' }));
    });
});
