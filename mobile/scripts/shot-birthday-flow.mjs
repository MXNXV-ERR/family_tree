// Walk the whole birthday flow and capture every beat.
//   node scripts/shot-birthday-flow.mjs [port]
// Assumes scripts/seedBirthdayTest.mjs --yes has been run.
import { chromium } from 'playwright';
import fs from 'fs';

const PORT = process.argv[2] || '8084';
const BASE = `http://localhost:${PORT}`;
const out = 'scripts/shots/flow';
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

// the celebration plays once per day — forget that so it replays here
const forgetReveal = () => page.evaluate(() => {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('ft.bday.')).forEach((k) => localStorage.removeItem(k));
  } catch {}
});
await forgetReveal();

console.log('\n--- home (celebrant) ---');
await shot('home-gold-hero');

console.log('--- celebration, beat by beat ---');
const orb = page.getByLabel('Open birthday wishes');
if (!(await orb.count())) { console.error('NO ORB — is a birthday in window?'); }
await orb.first().click({ force: true });

// reveal (crown) → opener → handover → links → rest
await page.waitForTimeout(400);  await shot('celebration-reveal-crown');
await page.waitForTimeout(1100); await shot('celebration-crown-hold');
await page.waitForTimeout(1600); await shot('celebration-opener-drift');
await page.waitForTimeout(1500); await shot('celebration-opener-hold');
await page.waitForTimeout(1400); await shot('celebration-handover');
await page.waitForTimeout(900);  await shot('celebration-links-drawing');
await page.waitForTimeout(2500); await shot('celebration-links-more');
await page.waitForTimeout(4000); await shot('celebration-settled');

console.log('--- the wall ---');
// let the sequence finish into the resting wall
await page.waitForTimeout(6000);
await shot('wall-at-rest');

console.log('--- a wish opens (polaroid) ---');
// tokens carry an uppercase "· NEW" label; click the first one
const token = page.locator('text=/·\\s*NEW/i').first();
if (await token.count()) {
  await token.click({ force: true });
  await page.waitForTimeout(1200);
  await shot('polaroid-open');
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(600);
  await shot('polaroid-scrolled');

  const reply = page.getByText('Reply', { exact: true }).first();
  if (await reply.count()) {
    await reply.click({ force: true });
    await page.waitForTimeout(900);
    await shot('polaroid-reply-open');
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(30, 300);
  await page.waitForTimeout(1200);
  await shot('wall-after-read');
} else {
  console.warn('  no unread token found on the wall');
}

console.log('--- composer ---');
await page.mouse.click(414 - 44, 896 - 98 - 20).catch(() => {});
await page.waitForTimeout(2000);
await shot('composer-repeat');
await page.mouse.wheel(0, 500);
await page.waitForTimeout(700);
await shot('composer-prior-wishes');
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(1200);

console.log('--- light mode ---');
await page.evaluate(() => { try { localStorage.setItem('ft.themeMode', 'light'); } catch {} });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(9000);
await shot('light-home');
const orbL = page.getByLabel('Open birthday wishes');
if (await orbL.count()) {
  await orbL.first().click({ force: true });
  await page.waitForTimeout(14000);   // let the sequence run out
  await shot('light-wall-ridges');
}
await page.evaluate(() => { try { localStorage.setItem('ft.themeMode', 'dark'); } catch {} });

console.log('--- archive (profile → Birthdays) ---');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(9000);
const meTab = page.getByText('Me', { exact: true }).first();
if (await meTab.count()) {
  await meTab.click({ force: true });
  await page.waitForTimeout(4000);
  const bd = page.getByText('birthdays', { exact: false }).first();
  if (await bd.count()) {
    await bd.click({ force: true });
    await page.waitForTimeout(2000);
    await shot('archive-years');
    const row = page.locator('text=/turned \\d+/').first();
    if (await row.count()) {
      await row.click({ force: true });
      await page.waitForTimeout(2500);
      await shot('archive-sky-open');
    }
  } else console.warn('  no Birthdays tab found');
}

console.log('\nconsole/page errors:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
