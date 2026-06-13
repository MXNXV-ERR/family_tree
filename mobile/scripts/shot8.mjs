// Design-implementation check: home (hero/nav), timeline events mode, profile,
// export. Captures + console errors.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

await page.goto(BASE, { timeout: 150000 });
await page.waitForSelector('input', { timeout: 150000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/d-login.png` });
await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6500);
await page.screenshot({ path: `${out}/d-home.png` });

// visualizer via hero
await page.getByText('Open tree', { exact: false }).click().catch(() => {});
await page.waitForTimeout(3000);
await page.getByText('timeline', { exact: true }).click().catch(() => {});
await page.waitForTimeout(2000);
await page.getByText('Lifespan + events', { exact: true }).click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/d-timeline-events.png` });

// tap a row to focus (click a name)
await page.getByText('Suresh Mehta', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/d-timeline-focus.png` });

// back to home, profile
await page.goBack().catch(() => {});
await page.waitForTimeout(2500);
await page.getByText('Diya Mehta', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/d-profile.png` });

console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
