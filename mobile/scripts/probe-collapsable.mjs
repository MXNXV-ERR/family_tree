// Locate the source of the `collapsable` non-boolean-attribute warning: visit
// each view in turn, print the FULL console error incl. React component stack.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let pending = [];
page.on('console', (m) => { if (m.type() === 'error') pending.push(m.text()); });

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
const flush = (label) => {
  if (pending.length) console.log(`--- after ${label} ---\n${pending.map((t) => t.slice(0, 1600)).join('\n====\n')}`);
  else console.log(`--- after ${label}: clean`);
  pending = [];
};
flush('login/tree');
for (const view of ['Radial', 'Network', 'Timeline', 'Tree']) {
  await page.getByText(view, { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(3500);
  flush(view);
}
await page.getByText('Hourglass', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2000);
flush('Hourglass');
await browser.close();
