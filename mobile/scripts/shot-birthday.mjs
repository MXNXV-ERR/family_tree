// Verify the birthday feature in the real web build: home (orb + gold row),
// the sky, and the composer. Usage: node scripts/shot-birthday.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
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
  await page.waitForTimeout(8000);
}
await page.screenshot({ path: `${out}/bday-home.png`, fullPage: false });

// the orb carries this accessibility label
const orb = page.getByLabel('Open birthday wishes');
const orbCount = await orb.count();
console.log('orb present:', orbCount > 0);
if (orbCount) {
  await orb.first().click({ force: true }); // the orb bobs forever — never 'stable'
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/bday-sky.png` });

  // open the composer from the FAB
  const fab = page.locator('text=Add another').first();
  await page.mouse.click(390 - 44, 896 - 98 - 20).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/bday-composer.png` });
}

console.log('console/page errors:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
