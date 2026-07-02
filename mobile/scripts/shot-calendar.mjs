// Verify: (1) first-name node labels, (2) network tap carries focus to other
// tabs (sub-bar "kinship around X"), (3) Family calendar drawer, (4) settings
// rows. Usage: node scripts/shot-calendar.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(4000);
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(7000);
}

// 1) tree view — first-name labels
await page.screenshot({ path: `${out}/cal-tree-firstnames.png` });

// 2) network view: tap a node, then switch to Radial — sub-bar must name it
await page.getByText('Network', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(5000);
await page.screenshot({ path: `${out}/cal-network.png` });

// node labels are 11px semibold texts; click one that isn't the focus already
const picked = await page.evaluate(() => {
  const divs = [...document.querySelectorAll('div')];
  const labels = divs.filter((d) => {
    const s = getComputedStyle(d);
    return s.fontSize === '11px' && d.children.length === 0 && (d.textContent ?? '').trim().length > 1;
  });
  const el = labels[Math.min(4, labels.length - 1)];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { text: el.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
console.log('tapped node label:', picked?.text ?? 'NONE FOUND');
if (picked) { await page.mouse.click(picked.x, picked.y); await page.waitForTimeout(1200); }

await page.getByText('Radial', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(4000);
const subbar = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => (d.textContent ?? '').startsWith('Radial — kinship around') && d.children.length === 0);
  return el ? el.textContent : null;
});
console.log('sub-bar after switch:', subbar);
await page.screenshot({ path: `${out}/cal-radial-carried.png` });

// 3) calendar drawer via the toolbar button (aria-label from IconBtn name)
await page.getByRole('button', { name: 'calendar', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/cal-panel.png` });

// export .ics → expect a download event
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.getByText('Export all as .ics', { exact: true }).click().catch(() => {});
const file = await dl;
console.log('ics download:', file ? await file.suggestedFilename() : 'NO DOWNLOAD');

// 4) settings — new rows
await page.getByRole('button', { name: 'settings', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1800);
console.log('firstNames row:', await page.getByText('First names in visuals', { exact: true }).count());
console.log('calendar row:', await page.getByText('Family calendar', { exact: true }).count());
await page.screenshot({ path: `${out}/cal-settings.png` });

console.log('console/page errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
