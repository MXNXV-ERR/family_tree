// Phase 1 visual check: login -> home -> open Add member form -> screenshot.
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

// login
const email = page.locator('input').first();
await email.fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]');
if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/p1-home.png` });

// open add form via FAB (the + button)
await page.getByText('+', { exact: true }).click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/p1-addform.png`, fullPage: true });

// try submitting empty to surface validation
await page.getByText('Add', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/p1-validation.png`, fullPage: true });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
