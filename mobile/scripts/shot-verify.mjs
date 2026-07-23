// Smoke test for the 2026-07-22 build: home (mail badge), inbox screen, event
// icon picker (emoji field), and the timeline events mode. The key signal is the
// console/page error list — a runtime crash in the new code surfaces there.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));
const shot = (n) => page.screenshot({ path: `${out}/verify-${n}.png` }).catch(() => {});

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
await shot('home');
console.log('home mail button:', (await page.getByText('Inbox', { exact: false }).count().catch(() => 0)) ? 'inbox tool present' : 'no inbox tool');

// Inbox screen
await page.goto(BASE + '/inbox', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2500);
await shot('inbox');
console.log('inbox screen:', (await page.getByText('Notes', { exact: true }).count().catch(() => 0)) ? 'rendered' : 'MISSING');

// Event icon picker (emoji field)
await page.goto(BASE + '/events', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2500);
await page.getByText('New event', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(1500);
console.log('event emoji field:', (await page.getByPlaceholder('Or type your own emoji…').count().catch(() => 0)) ? 'rendered' : 'MISSING');
await shot('event-iconpicker');

// Timeline → events mode (EventGlyph markers, de-collision)
await page.goto(BASE + '/tree', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3000);
await page.getByText('Timeline', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.getByText('Events', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2000);
await shot('timeline-events');

console.log('console/page errors:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
