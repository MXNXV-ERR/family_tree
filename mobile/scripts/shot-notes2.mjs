import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 430, height: 940 } });
const err = [];
p.on('console', (x) => { if (x.type() === 'error') err.push(x.text().slice(0, 200)); });
p.on('pageerror', (e) => err.push('PAGEERR ' + String(e).slice(0, 200)));
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(4000);
const e = p.locator('input').first();
if (await e.count()) { await e.fill('jatin75b@gmail.com'); const pw = p.locator('input[type="password"]'); if (await pw.count()) await pw.fill('password'); await p.getByText('Sign In', { exact: true }).click().catch(() => {}); await p.waitForTimeout(9000); }

await p.getByText('Suresh', { exact: false }).first().click().catch(() => {});
await p.waitForTimeout(2000);
await p.getByText('Send note', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(2000);
console.log('Subject field:', (await p.getByPlaceholder('Subject (optional)').count().catch(() => 0)) ? 'yes' : 'no');
console.log('Reveal label:', (await p.getByText('Reveal', { exact: true }).count().catch(() => 0)) ? 'yes' : 'no');
console.log('Balloons effect:', (await p.getByText('Balloons', { exact: true }).count().catch(() => 0)) ? 'yes' : 'no');
// choose envelope reveal + balloons effect (fires preview)
await p.getByText('Envelope', { exact: true }).first().click().catch(() => {});
await p.getByText('Balloons', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/notes2-compose.png` });
await p.goto(BASE + '/inbox', { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(2000);
await p.screenshot({ path: `${out}/notes2-inbox.png` });
console.log('errors:', err.length ? err.slice(0, 12) : 'none');
await browser.close();
