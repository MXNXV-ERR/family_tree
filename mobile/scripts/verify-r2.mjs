// Round-2 verification: radial gradient rings + depth slider, timeline toolbar
// slider, drawer-below-toolbar, desktop login, facematch desktop, and a
// light-mode + large-text + years-off pass via localStorage. Captures errors.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const allErr = [];
const attach = (page, tag) => {
  page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) allErr.push(`[${tag}] ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => allErr.push(`[${tag}] PAGEERROR ${String(e).slice(0, 160)}`));
};
async function login(page) {
  await page.waitForSelector('input', { timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.locator('input').first().fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
  // The desktop card title is also "Sign in" (a Text), so target the button by role.
  const btn = page.getByRole('button', { name: /sign in/i });
  if (await btn.count()) await btn.first().click().catch(() => {});
  else await page.getByText('Sign In', { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(7000);
}

// 1) Desktop LOGIN (fresh context = signed out)
const c1 = await browser.newContext({ viewport: { width: 1340, height: 860 } });
const loginPage = await c1.newPage(); attach(loginPage, 'login');
await loginPage.goto(BASE, { timeout: 180000 });
await loginPage.waitForTimeout(2500);
await loginPage.screenshot({ path: `${out}/r2-desktop-login.png` });

// 2) Desktop DARK workspace — radial + timeline + drawer
const dPage = await c1.newPage(); attach(dPage, 'desktop');
await dPage.goto(BASE, { timeout: 180000 });
await login(dPage);
await dPage.getByText('Radial', { exact: true }).first().click().catch(() => {});
await dPage.waitForTimeout(2000);
await dPage.screenshot({ path: `${out}/r2-desktop-radial.png` });
await dPage.getByText('Timeline', { exact: true }).first().click().catch(() => {});
await dPage.waitForTimeout(2000);
await dPage.screenshot({ path: `${out}/r2-desktop-timeline.png` });
// drawer below toolbar: open Ask AI drawer, confirm toolbar still shows
await dPage.getByText('Ask AI', { exact: false }).first().click().catch(() => {});
await dPage.waitForTimeout(1200);
await dPage.screenshot({ path: `${out}/r2-desktop-drawer.png` });
// settings drawer via the tune icon (coordinate in the right cluster)
await dPage.keyboard.press('Escape').catch(() => {});
await dPage.mouse.click(1056, 37).catch(() => {});
await dPage.waitForTimeout(1000);
await dPage.screenshot({ path: `${out}/r2-desktop-settings.png` });
// facematch desktop
await dPage.goto(BASE + '/facematch', { timeout: 60000 }).catch(() => {});
await dPage.waitForTimeout(2500);
await dPage.screenshot({ path: `${out}/r2-desktop-facematch.png` });

// 3) Desktop LIGHT + large text + years-off (set prefs, then load)
const c2 = await browser.newContext({ viewport: { width: 1340, height: 860 } });
await c2.addInitScript(() => {
  localStorage.setItem('ft.themeMode', 'light');
  localStorage.setItem('ft.settings', JSON.stringify({ years: false, glass: true, motion: true, textSize: 'lg' }));
});
const lPage = await c2.newPage(); attach(lPage, 'light');
await lPage.goto(BASE, { timeout: 180000 });
await login(lPage);
await lPage.waitForTimeout(1500);
await lPage.screenshot({ path: `${out}/r2-desktop-light.png` });

// 4) Mobile light home (years off)
const c3 = await browser.newContext({ viewport: { width: 414, height: 896 } });
await c3.addInitScript(() => {
  localStorage.setItem('ft.themeMode', 'light');
  localStorage.setItem('ft.settings', JSON.stringify({ years: false, glass: true, motion: true, textSize: 'md' }));
});
const mPage = await c3.newPage(); attach(mPage, 'mobile-light');
await mPage.goto(BASE, { timeout: 180000 });
await login(mPage);
await mPage.waitForTimeout(1200);
await mPage.screenshot({ path: `${out}/r2-mobile-light.png` });

console.log('CONSOLE ERRORS:', allErr.length ? '\n' + allErr.slice(0, 14).join('\n') : 'none');
await browser.close();
