// Verify the Face Match route bundles + mounts (loads @vladmandic/face-api on web).
// Usage: node scripts/shot-face.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3000);

const email = page.locator('input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(6000);
}

await page.goto(BASE + '/facematch', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(20000); // let Metro bundle face-api + the screen render
await page.screenshot({ path: 'scripts/shots/face.png' });
console.log('facematch body text len:', (await page.locator('body').innerText().catch(() => '')).length);

console.log('console/page errors:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
