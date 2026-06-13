// Phase 4 visual check: login -> open visualizer -> Tree/Radial/Timeline.
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

// open visualizer
await page.getByText('🌳', { exact: true }).click().catch(() => {});
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/p4-tree.png` });

await page.getByText('radial', { exact: true }).click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/p4-radial.png` });

await page.getByText('timeline', { exact: true }).click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/p4-timeline.png` });

console.log('console/page errors:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
