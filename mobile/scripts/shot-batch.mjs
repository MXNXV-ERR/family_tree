// Smoke the 2026-07-23 batch: per-member Life timeline tab, inbox render, and
// that the desktop workspace still boots after the notes-drawer wiring.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(4000);
  const email = page.locator('input[type="email"], input').first();
  if (await email.count()) {
    await email.fill('jatin75b@gmail.com');
    const pwd = page.locator('input[type="password"]');
    if (await pwd.count()) await pwd.fill('password');
    await page.getByText('Sign In', { exact: true }).click().catch(() => {});
    await page.waitForTimeout(9000);
  }
}

// ---- mobile ----
const m = await browser.newPage({ viewport: { width: 430, height: 900 } });
const merr = [];
m.on('console', (x) => { if (x.type() === 'error') merr.push(x.text().slice(0, 200)); });
m.on('pageerror', (e) => merr.push('PAGEERROR ' + String(e).slice(0, 200)));
await login(m);
await m.getByText('Suresh', { exact: false }).first().click().catch(() => {});
await m.waitForTimeout(2500);
await m.getByText('Life', { exact: true }).first().click().catch(() => {});
await m.waitForTimeout(1500);
console.log('Life tab present:', (await m.getByText('Life', { exact: true }).count().catch(() => 0)) ? 'yes' : 'no');
await m.screenshot({ path: `${out}/batch-life.png` });
await m.goto(BASE + '/inbox', { waitUntil: 'networkidle' }).catch(() => {});
await m.waitForTimeout(2000);
await m.screenshot({ path: `${out}/batch-inbox.png` });
console.log('mobile errors:', merr.length ? merr.slice(0, 10) : 'none');
await m.close();

// ---- desktop (boot check after drawer wiring) ----
const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const derr = [];
d.on('console', (x) => { if (x.type() === 'error') derr.push(x.text().slice(0, 200)); });
d.on('pageerror', (e) => derr.push('PAGEERROR ' + String(e).slice(0, 200)));
await login(d);
await d.waitForTimeout(1500);
await d.screenshot({ path: `${out}/batch-desktop.png` });
console.log('desktop errors:', derr.length ? derr.slice(0, 10) : 'none');
await browser.close();
