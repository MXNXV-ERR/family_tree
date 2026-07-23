// Desktop smoke: verify the workspace toolbar (Inbox button) + a profile drawer
// render without errors after the desktop wiring.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3000);
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(8000);
}
await page.screenshot({ path: `${out}/verify-desktop-home.png` });

// Open a member profile drawer via the toolbar search.
await page.locator('input').last().fill('Rohan').catch(() => {});
await page.waitForTimeout(1200);
await page.getByText('Rohan', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/verify-desktop-profile.png` });

console.log('desktop console/page errors:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
