// Screenshot the combined (master) view chrome: toolbar, search overlay,
// profile drawer, settings/members/chat panels.
// Usage: node scripts/shot-master-chrome.mjs <masterId> [outDir]
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const masterId = process.argv[2] || '';
const out = process.argv[3] || 'scripts/shots';

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
await page.waitForTimeout(11000);
await page.screenshot({ path: `${out}/chrome-1-base.png` });

// search overlay → type → pick a result (opens the drawer profile on desktop)
await page.locator('[aria-label="search"]').first().click();
await page.waitForTimeout(800);
await page.keyboard.type('Priya');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/chrome-2-search.png` });
const row = page.getByText('Priya', { exact: false }).nth(1);
await row.click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/chrome-3-profile.png` });

await page.locator('[aria-label="settings"]').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/chrome-4-settings.png` });

await page.locator('[aria-label="users"]').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/chrome-5-members.png` });

await page.locator('[aria-label="sparkles"]').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/chrome-6-chat.png` });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
