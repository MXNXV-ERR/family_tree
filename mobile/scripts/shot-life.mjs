import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 430, height: 900 } });
const err = [];
p.on('console', (x) => { if (x.type() === 'error') err.push(x.text().slice(0, 200)); });
p.on('pageerror', (e) => err.push('PAGEERROR ' + String(e).slice(0, 200)));
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(4000);
const email = p.locator('input').first();
if (await email.count()) { await email.fill('jatin75b@gmail.com'); const pw = p.locator('input[type="password"]'); if (await pw.count()) await pw.fill('password'); await p.getByText('Sign In', { exact: true }).click().catch(() => {}); await p.waitForTimeout(9000); }
// Rohan (the "YOU" node) has a spouse + children → richer life timeline.
await p.getByText('Rohan', { exact: false }).first().click().catch(() => {});
await p.waitForTimeout(2500);
await p.getByText('life', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(1500);
await p.screenshot({ path: 'scripts/shots/life-tab.png' });
console.log('errors:', err.length ? err.slice(0, 8) : 'none');
await browser.close();
