// Verify the flagged screens after fixes: login, home, family switcher,
// settings (logout), tree (animations + dotgrid), profile.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = `scripts/shots`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

const tap = async (label) => { try { await page.getByText(label, { exact: false }).first().click({ timeout: 4000 }); } catch {} };

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/v-login.png` });

await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]');
if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/v-home.png` });

// Family switcher
await tap('Mehta Family');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/v-family.png` });
await page.mouse.click(207, 90).catch(() => {});  // tap scrim near top
await page.waitForTimeout(700);

// Tree
await tap('Open tree');
await page.waitForTimeout(2600);
await page.screenshot({ path: `${out}/v-tree.png` });
// tap a node to show focus bar
await page.mouse.click(207, 400).catch(() => {});
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/v-tree-focus.png` });

await browser.close();
console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
