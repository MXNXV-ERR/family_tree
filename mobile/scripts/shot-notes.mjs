// Capture the notes flow after "send to anyone": profile Send-note on a member
// that isn't you, the compose screen, and the inbox.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3500);
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(9000);
}

// Open a member profile (Suresh is not the logged-in user's node → Send note shows).
await page.getByText('Suresh', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(2500);
console.log('Send note button present:', (await page.getByText('Send note', { exact: true }).count().catch(() => 0)) ? 'yes' : 'no');
await page.screenshot({ path: `${out}/notes-profile.png` });

await page.getByText('Send note', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/notes-compose.png` });

await page.goto(BASE + '/inbox', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/notes-inbox.png` });

console.log('notes console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
