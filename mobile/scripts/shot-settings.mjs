// Desktop: click the actual settings (tune) icon, capture the drawer + sign out.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = `scripts/shots`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3500);
await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]');
if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);
// settings 'tune' icon — 3rd ghost icon in the right cluster (~x=997)
await page.mouse.click(997, 38).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/set-desktop2.png` });
console.log('Sign out:', await page.getByText('Sign out', { exact: false }).count());
await browser.close();
