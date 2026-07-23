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

// compose a themed note to Suresh (Zoom reveal + Confetti + seal)
await p.getByText('Suresh', { exact: false }).first().click().catch(() => {});
await p.waitForTimeout(2000);
await p.getByText('Send note', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(2000);
const subj = 'Party time ' + Date.now().toString().slice(-4);
await p.getByPlaceholder('Subject (optional)').fill(subj).catch(() => {});
await p.getByPlaceholder('seal').fill('🎉').catch(() => {});
await p.getByText('Zoom', { exact: true }).first().click().catch(() => {});
await p.getByText('Confetti', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(400);
await p.getByText('Send note', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(3500);

// inbox → Sent → open the note
await p.goto(BASE + '/inbox', { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(2500);
await p.getByText('sent', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(1500);
console.log('note in Sent:', (await p.getByText(subj, { exact: false }).count().catch(() => 0)) ? 'yes' : 'NO (rules not deployed?)');
await p.getByText(subj, { exact: false }).first().click().catch(() => {});
await p.waitForTimeout(380);
await p.screenshot({ path: `${out}/thread-reveal-mid.png` });
await p.waitForTimeout(1700);
await p.screenshot({ path: `${out}/thread-settled.png` });
console.log('reply box:', (await p.getByPlaceholder('Reply…').count().catch(() => 0)) ? 'present' : 'missing');
console.log('errors:', err.length ? err.slice(0, 12) : 'none');
await browser.close();
