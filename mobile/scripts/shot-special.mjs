import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(4000);
  const e = page.locator('input').first();
  if (await e.count()) {
    await e.fill('jatin75b@gmail.com');
    const p = page.locator('input[type="password"]');
    if (await p.count()) await p.fill('password');
    await page.getByText('Sign In', { exact: true }).click().catch(() => {});
    await page.waitForTimeout(9000);
  }
}

// ---- desktop FocusBar (tap a tree node → bottom bar with Profile →) ----
const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const derr = [];
d.on('console', (x) => { if (x.type() === 'error') derr.push(x.text().slice(0, 200)); });
d.on('pageerror', (e) => derr.push('PAGEERR ' + String(e).slice(0, 200)));
await login(d);
await d.waitForTimeout(2500);
await d.getByText('Rohan', { exact: false }).first().click().catch(() => {});
await d.waitForTimeout(1200);
console.log('desktop FocusBar Profile arrow:', (await d.getByText('Profile', { exact: false }).count().catch(() => 0)) ? 'shown' : 'MISSING');
await d.screenshot({ path: `${out}/special-desktop-bar.png` });
console.log('desktop errors:', derr.length ? derr.slice(0, 8) : 'none');
await d.close();

// ---- mobile compose Style picker + effect preview ----
const m = await browser.newPage({ viewport: { width: 430, height: 900 } });
const merr = [];
m.on('console', (x) => { if (x.type() === 'error') merr.push(x.text().slice(0, 200)); });
m.on('pageerror', (e) => merr.push('PAGEERR ' + String(e).slice(0, 200)));
await login(m);
await m.getByText('Suresh', { exact: false }).first().click().catch(() => {});
await m.waitForTimeout(2000);
await m.getByText('Send note', { exact: true }).first().click().catch(() => {});
await m.waitForTimeout(2000);
console.log('compose Style section:', (await m.getByText('Style', { exact: false }).count().catch(() => 0)) ? 'shown' : 'MISSING');
await m.getByText('Confetti', { exact: true }).first().click().catch(() => {});
await m.waitForTimeout(400);
await m.screenshot({ path: `${out}/special-compose.png` });
console.log('mobile errors:', merr.length ? merr.slice(0, 8) : 'none');
await browser.close();
