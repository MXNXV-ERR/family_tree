// Smoke check for the Fable build: desktop workspace (toolbar, view switches,
// node drawer) + mobile home/settings/family/edit-back. Captures console errors.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();

async function login(page) {
  await page.goto(BASE, { timeout: 180000 });
  await page.waitForSelector('input', { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.locator('input').first().fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
  await page.getByText(/^Sign ?in$/i).first().click().catch(() => {});
  await page.waitForTimeout(7000);
}

const errors = [];
const attach = (page, tag) => {
  page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) errors.push(`[${tag}] ` + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR ` + String(e).slice(0, 200)));
};

// ---------- DESKTOP ----------
const desktop = await browser.newPage({ viewport: { width: 1340, height: 880 } });
attach(desktop, 'desktop');
await login(desktop);
await desktop.screenshot({ path: `${out}/fable-desktop-home.png` });
for (const v of ['Radial', 'Timeline', 'Tree']) {
  await desktop.getByText(v, { exact: true }).first().click().catch(() => {});
  await desktop.waitForTimeout(1800);
  await desktop.screenshot({ path: `${out}/fable-desktop-${v.toLowerCase()}.png` });
}
// open settings drawer via "tune" — fall back to clicking a node name for the profile drawer
await desktop.getByText(/Mehta|Kapoor|Sharma/).first().click().catch(() => {});
await desktop.waitForTimeout(1500);
await desktop.screenshot({ path: `${out}/fable-desktop-drawer.png` });
// open family switcher
await desktop.getByText('My Family', { exact: false }).first().click().catch(() => {});
await desktop.waitForTimeout(1200);
await desktop.screenshot({ path: `${out}/fable-desktop-family.png` });

// ---------- MOBILE ----------
const mobile = await browser.newPage({ viewport: { width: 414, height: 896 } });
attach(mobile, 'mobile');
await login(mobile);
await mobile.screenshot({ path: `${out}/fable-mobile-home.png` });
// open a member profile then edit -> verify back button renders
await mobile.getByText(/Mehta|Kapoor|Sharma/).first().click().catch(() => {});
await mobile.waitForTimeout(1800);
await mobile.screenshot({ path: `${out}/fable-mobile-profile.png` });
await mobile.getByText('Edit', { exact: true }).first().click().catch(() => {});
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: `${out}/fable-mobile-edit.png` });

console.log('CONSOLE ERRORS:', errors.length ? '\n' + errors.slice(0, 12).join('\n') : 'none');
await browser.close();
