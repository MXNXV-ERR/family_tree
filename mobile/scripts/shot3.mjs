// Phase 3 visual check: login -> tap a member -> profile tabs.
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
await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]');
if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);

// tap first member row
await page.getByText('Diya Mehta', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/p3-info.png`, fullPage: true });

await page.getByText('relations', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/p3-relations.png`, fullPage: true });

await page.getByText('story', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/p3-story.png`, fullPage: true });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
