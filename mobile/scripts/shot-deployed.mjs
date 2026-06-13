// Load the PRODUCTION export (served from dist) and capture console + page errors.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => logs.push('PAGEERROR ' + String(e.stack || e).slice(0, 500)));
await page.goto('https://family-tree-6a597.web.app/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: 'scripts/shots/prod-home.png' });
const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 200);
console.log('--- body text ---\n', JSON.stringify(bodyText));
console.log('--- logs ---');
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
