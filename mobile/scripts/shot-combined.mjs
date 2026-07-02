// Screenshot the combined (master) view — verify the joined tree + family colors.
// Usage: node scripts/shot-combined.mjs <masterId>
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const masterId = process.argv[2] || '';
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
  await page.waitForTimeout(6000);
}

await page.goto(`${BASE}/master?id=${masterId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(11000); // bundle + Firestore load + layout/force-sim settle
await page.screenshot({ path: `${out}/combined-tree.png` });

// switch to Network view
await page.getByText('Network', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/combined-network.png` });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
