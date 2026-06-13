// Phase 2 visual check: login -> home (two FABs) -> open Add Link -> pick A & B -> capture validation.
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
await page.screenshot({ path: `${out}/p2-home-fabs.png` });

// open link dialog via 🔗 FAB
await page.getByText('🔗', { exact: true }).click().catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/p2-linkform.png`, fullPage: true });

// pick person A: type in first search box, click first result
const searchA = page.getByPlaceholder('Search name…').first();
await searchA.fill('a');
await page.waitForTimeout(800);
// click first picker row name
const rows = page.locator('text=/.+/');
await page.screenshot({ path: `${out}/p2-pickA.png`, fullPage: true });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
