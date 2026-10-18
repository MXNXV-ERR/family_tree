// Light mode check (SPEC 8): dawn ridges, sun glow, the hub pinned inside it.
import { chromium } from 'playwright';

const BASE = `http://localhost:${process.argv[2] || '8082'}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
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
// flip to the light theme the way the toggle does
await page.evaluate(() => { try { localStorage.setItem('ft.themeMode', 'light'); } catch {} });
await page.reload({ waitUntil: 'load' }); // firestore's long-poll never goes idle
await page.waitForTimeout(8000);

const orb = page.getByLabel('Open birthday wishes');
if (await orb.count()) {
  await orb.first().click({ force: true });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'scripts/shots/bday-light.png' });
}
await page.evaluate(() => { try { localStorage.setItem('ft.themeMode', 'dark'); } catch {} });
console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
