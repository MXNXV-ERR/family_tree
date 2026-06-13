// Phase 7 check: export screen renders; JSON/CSV/SVG downloads fire; re-importing
// the exported JSON skips all as duplicates (proves parse+merge+dedupe, no writes).
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const dl = 'scripts/dl';
fs.mkdirSync(dl, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
const downloads = [];
page.on('download', async (d) => { const p = `${dl}/${d.suggestedFilename()}`; await d.saveAs(p).catch(() => {}); downloads.push(d.suggestedFilename()); });

await page.goto(BASE, { timeout: 120000 });
await page.waitForSelector('input', { timeout: 120000 });
await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);

await page.getByText('⤓', { exact: true }).click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/p7-screen.png` });

for (const fmt of ['JSON', 'CSV', 'SVG']) {
  await page.getByText(fmt, { exact: true }).click().catch(() => {});
  await page.waitForTimeout(2500);
}

// Re-import the exported JSON → expect all duplicates skipped.
const jsonPath = `${dl}/family-tree.json`;
if (fs.existsSync(jsonPath)) {
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
    page.getByText('Choose file to import', { exact: false }).click().catch(() => {}),
  ]);
  if (fc) await fc.setFiles(jsonPath);
  let status = '';
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1500);
    const txt = await page.locator('body').innerText().catch(() => '');
    const m = txt.match(/(Imported [^\n]+|Nothing new to import[^\n]+|Import failed[^\n]+)/);
    if (m) { status = m[1]; break; }
  }
  console.log('import status:', status || '(none)');
}
await page.screenshot({ path: `${out}/p7-after.png`, fullPage: true });
console.log('downloads:', downloads, '| errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
