// The cases the main flow script doesn't reach: the two-member family (the
// design's default case), the archive, reduced motion, and the sealed screen.
//   node scripts/shot-birthday-cases.mjs [port]
import { chromium } from 'playwright';
import fs from 'fs';

const PORT = process.argv[2] || '8084';
const BASE = `http://localhost:${PORT}`;
const out = 'scripts/shots/cases';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 240)));

let n = 0;
const shot = async (name) => {
  n += 1;
  await page.screenshot({ path: `${out}/${String(n).padStart(2, '0')}-${name}.png` });
  console.log('  shot', String(n).padStart(2, '0'), name);
};
const home = async () => {
  await page.goto(`${BASE}/home`, { waitUntil: 'load' });
  await page.waitForTimeout(7000);
};

await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(4000);
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(9000);
}
const forget = () => page.evaluate(() => {
  try { Object.keys(localStorage).filter((k) => k.startsWith('ft.bday.')).forEach((k) => localStorage.removeItem(k)); } catch {}
});

// ---------------------------------------------- two-member family ----------
console.log('\n--- switch to the two-member family ---');
await home();
await page.getByText('Mehta Family', { exact: false }).first().click({ force: true }).catch(() => {});
await page.waitForTimeout(2500);
await shot('family-info-panel');
const switchBtn = page.getByText('Switch family', { exact: false }).first();
if (await switchBtn.count()) { await switchBtn.click({ force: true }); await page.waitForTimeout(2000); }
await shot('family-picker');
const two = page.getByText('Two of Us', { exact: false }).first();
if (await two.count()) {
  await two.click({ force: true });
  await page.waitForTimeout(6000);
  await shot('two-home-gold-hero');

  await forget();
  await page.goto(`${BASE}/home`, { waitUntil: 'load' });
  await page.waitForTimeout(7000);
  const orb = page.getByLabel('Open birthday wishes');
  if (await orb.count()) {
    await orb.first().click({ force: true });
    await page.waitForTimeout(700);  await shot('two-crown');
    await page.waitForTimeout(2200); await shot('two-opener');
    await page.waitForTimeout(2600); await shot('two-handover');
    await page.waitForTimeout(1600); await shot('two-links');
    await page.waitForTimeout(7000); await shot('two-wall');

    const token = page.locator('text=/·\\s*NEW/i').first();
    if (await token.count()) {
      await token.click({ force: true });
      await page.waitForTimeout(1400);
      await shot('two-polaroid');
      await page.mouse.click(30, 820);
      await page.waitForTimeout(1200);
    }
    // the light sweep: a RETURN visit to the wall
    await page.goto(`${BASE}/home`, { waitUntil: 'load' });
    await page.waitForTimeout(6000);
    const orb2 = page.getByLabel('Open birthday wishes');
    if (await orb2.count()) {
      await orb2.first().click({ force: true });
      await page.waitForTimeout(2500);
      await shot('two-wall-return-sweep');
    }
  } else console.warn('  no orb in the two-member family');
} else console.warn('  "Two of Us" not in the picker');

// ---------------------------------------------- reduced motion -------------
console.log('--- reduced motion ---');
await page.evaluate(() => {
  try {
    const raw = localStorage.getItem('ft.settings');
    const s = raw ? JSON.parse(raw) : {};
    localStorage.setItem('ft.settings', JSON.stringify({ ...s, motion: false }));
  } catch {}
});
await forget();
await page.goto(`${BASE}/home`, { waitUntil: 'load' });
await page.waitForTimeout(7000);
const orbRM = page.getByLabel('Open birthday wishes');
if (await orbRM.count()) {
  await orbRM.first().click({ force: true });
  await page.waitForTimeout(2500);
  await shot('reduced-motion-wall');
}
await page.evaluate(() => {
  try {
    const raw = localStorage.getItem('ft.settings');
    const s = raw ? JSON.parse(raw) : {};
    localStorage.setItem('ft.settings', JSON.stringify({ ...s, motion: true }));
  } catch {}
});

// ---------------------------------------------- archive --------------------
console.log('--- archive (profile → Birthdays) ---');
await home();
const me = page.getByText('Me', { exact: true }).first();
if (await me.count()) {
  await me.click({ force: true });
  await page.waitForTimeout(5000);
  const tab = page.getByText('birthdays', { exact: false }).first();
  if (await tab.count()) {
    await tab.click({ force: true });
    await page.waitForTimeout(2500);
    await shot('archive-years');
    const row = page.locator('text=/turned \\d+|^\\d{4}$/').first();
    if (await row.count()) {
      await row.click({ force: true });
      await page.waitForTimeout(3000);
      await shot('archive-sky');
    }
  } else console.warn('  no Birthdays tab');
}

// ---------------------------------------------- desktop --------------------
console.log('--- desktop workspace ---');
// Reuse the SAME page (just widened): a fresh page means a fresh context with
// no session, which parks the workspace on its loading spinner forever.
const wide = page;
await wide.setViewportSize({ width: 1280, height: 820 });
await wide.goto(`${BASE}/home`, { waitUntil: 'load' });
await wide.waitForTimeout(18000);
await wide.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-desktop-toolbar.png` });
console.log('  shot', n, 'desktop-toolbar');
const cake = wide.getByLabel('Birthday').first();
if (await cake.count()) {
  await cake.click({ force: true });
  await wide.waitForTimeout(4000);
  await wide.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-desktop-drawer-wall.png` });
  console.log('  shot', n, 'desktop-drawer-wall');
} else console.warn('  no cake tool in the toolbar');

console.log('\nconsole/page errors:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
