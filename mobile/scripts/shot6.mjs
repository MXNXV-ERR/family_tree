// Phase 6 check: open the web chat sheet, ask a real family question, confirm
// Gemini replies with member chips.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

await page.goto(BASE, { timeout: 120000 });
await page.waitForSelector('input', { timeout: 120000 });
await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);

await page.getByText('✨', { exact: true }).click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/p6-open.png` });

// Tap a suggestion to send a real query.
await page.getByText('How is Jatin related to Diya?', { exact: false }).click().catch(() => {});
let replied = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  const txt = await page.locator('body').innerText().catch(() => '');
  // reply present once "Thinking…" is gone and there's text after our question
  if (!/Thinking…/.test(txt) && /related to Diya/.test(txt)) {
    const after = txt.split('How is Jatin related to Diya?').pop() || '';
    if (after.replace(/\s/g, '').length > 12) { replied = true; break; }
  }
}
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/p6-reply.png`, fullPage: true });
console.log('replied:', replied, '| errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
