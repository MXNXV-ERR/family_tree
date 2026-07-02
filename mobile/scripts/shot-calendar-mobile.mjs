// Mobile viewport: Calendar quick-tool → sheet, settings rows.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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

await page.getByText('Calendar', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/cal-mobile-sheet.png` });
console.log('calendar sheet head:', await page.getByText('Family calendar', { exact: true }).count());

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
