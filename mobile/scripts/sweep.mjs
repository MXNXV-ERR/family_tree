// Phase 8 web parity sweep: capture key screens at phone (414) and desktop (1280).
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

async function login(page) {
  await page.goto(BASE, { timeout: 120000 });
  await page.waitForSelector('input', { timeout: 120000 });
  await page.locator('input').first().fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(6000);
}

const browser = await chromium.launch();
const errors = [];

for (const [tag, w, h] of [['phone', 414, 896], ['desktop', 1280, 860]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) errors.push(`${tag}: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => errors.push(`${tag} PAGEERROR ${String(e).slice(0, 160)}`));
  await login(page);
  await page.screenshot({ path: `${out}/sweep-${tag}-home.png` });

  // open menu
  await page.getByText('☰', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/sweep-${tag}-menu.png` });
  // visualize → timeline (check living-bar fit)
  await page.getByText('Visualize', { exact: false }).click().catch(() => {});
  await page.waitForTimeout(3000);
  await page.getByText('timeline', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/sweep-${tag}-timeline.png` });
  await ctx.close();
}

console.log('errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
