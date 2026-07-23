import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 430, height: 900 } });
const err = [];
p.on('console', (x) => { if (x.type() === 'error') err.push(x.text().slice(0, 200)); });
p.on('pageerror', (e) => err.push('PAGEERR ' + String(e).slice(0, 200)));
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(4000);
const e = p.locator('input').first();
if (await e.count()) { await e.fill('jatin75b@gmail.com'); const pw = p.locator('input[type="password"]'); if (await pw.count()) await pw.fill('password'); await p.getByText('Sign In', { exact: true }).click().catch(() => {}); await p.waitForTimeout(9000); }
await p.goto(BASE + '/inbox', { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/reply-inbox.png` });
// open the first note in the list
const first = p.locator('text=/froe|Note|flowers|Party/i').first();
await first.click().catch(() => {});
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/reply-open-mid.png` });
await p.waitForTimeout(1700);
await p.screenshot({ path: `${out}/reply-open.png` });
console.log('reply box present:', (await p.getByPlaceholder('Reply…').count().catch(() => 0)) ? 'YES' : 'no');
console.log('errors:', err.length ? err.slice(0, 12) : 'none');
await browser.close();
