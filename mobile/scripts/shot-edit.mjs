// Focused check: mobile profile -> Edit -> confirm the new back-button header.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

await page.goto(BASE, { timeout: 180000 });
await page.waitForSelector('input', { timeout: 180000 });
await page.waitForTimeout(1200);
await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
await page.getByText(/^Sign ?in$/i).first().click().catch(() => {});
await page.waitForTimeout(7000);

// open a member profile via a name that does NOT collide with the header
await page.getByText('Anjali Desai', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/fable-edit-profile.png` });
// open the editor
await page.getByText('Edit', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/fable-edit-form.png` });

console.log('CONSOLE ERRORS:', errors.length ? '\n' + errors.slice(0, 10).join('\n') : 'none');
await browser.close();
