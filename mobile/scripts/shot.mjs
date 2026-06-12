// Load the Expo web build in a real browser, screenshot login + (optionally) log in.
// Usage: node scripts/shot.mjs [suffix]
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const suffix = process.argv[2] || 'phase0';
const out = `scripts/shots`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } }); // phone-ish
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/${suffix}-login.png` });

// Try login
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  // password is the secureTextEntry input
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/${suffix}-home.png` });
}

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
