// Verify export redesign: 4 views + theme toggle + radial controls + SVG
// download; live Network tab photo avatars.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(4000);
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(7000);
}

// open export drawer
await page.getByRole('button', { name: 'download', exact: true }).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/export-tree-light.png` });

// dark theme
await page.getByRole('button', { name: 'theme Dark', exact: true }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/export-tree-dark.png` });
await page.getByRole('button', { name: 'theme Light', exact: true }).click();

// radial: open centre picker, choose the 3rd match, bump depth via track click
await page.getByText('Radial', { exact: true }).last().click();
await page.waitForTimeout(1500);
await page.getByText('Centre', { exact: true }).click();
await page.waitForTimeout(600);
const rows = page.locator('div').filter({ hasText: /^…$/ }); // noop guard
const pickRow = page.getByText('Kamla Mehta', { exact: true }).first();
if (await pickRow.count()) await pickRow.click(); else await page.getByText('Search person…').first().press('Escape').catch(() => {});
await page.waitForTimeout(800);
const depthLbl = await page.getByText('Depth', { exact: true }).boundingBox();
if (depthLbl) {
  await page.mouse.click(depthLbl.x + depthLbl.width + 10 + 150 * 0.95, depthLbl.y + depthLbl.height / 2);
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: `${out}/export-radial.png` });

// timeline + network previews
await page.getByText('Timeline', { exact: true }).last().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/export-timeline.png` });
await page.getByText('Network', { exact: true }).last().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/export-network.png` });

// SVG download for network view
const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
await page.getByText('SVG', { exact: true }).click();
const file = await dl;
console.log('svg download:', file ? await file.suggestedFilename() : 'NO DOWNLOAD');

// live network tab — photo avatars (Vikram/Aarav have photos in Mehta data)
await page.getByRole('button', { name: 'close', exact: true }).first().click().catch(() => {});
await page.keyboard.press('Escape').catch(() => {});
await page.getByText('Network', { exact: true }).first().click();
await page.waitForTimeout(5000);
const imgs = await page.evaluate(() => document.querySelectorAll('img').length);
console.log('live network <img> count:', imgs);
await page.screenshot({ path: `${out}/network-photos.png` });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
