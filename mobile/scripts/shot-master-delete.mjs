// Master (combined view) delete affordance: open the existing master via the
// family switcher, verify the toolbar trash + confirm dialog. Dialog is always
// DISMISSED — this never deletes the user's real master.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8082';
const out = 'scripts/shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
const dialogs = [];
page.on('dialog', (d) => { dialogs.push(d.message().slice(0, 140)); d.dismiss().catch(() => {}); });

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

// toolbar family pill → family info → Switch family → picker with Combined rows
await page.getByText('Mehta Family', { exact: false }).first().click();
await page.waitForTimeout(1500);
await page.getByText('Switch family', { exact: true }).first().click();
await page.waitForTimeout(1500);
const combined = page.getByText(/^\d+ families$/).first();
if (!(await combined.count())) {
  console.log('FAIL: no Combined row in switcher');
  await page.screenshot({ path: `${out}/a2-master-switcher.png` });
  await browser.close();
  process.exit(1);
}
await combined.click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/a2-master.png` });

const trash = page.getByRole('button', { name: 'trash', exact: true }).first();
console.log(`trash button on master screen: ${(await trash.count()) ? 'OK' : 'FAIL'}`);
await trash.click();
await page.waitForTimeout(900);
console.log(`confirm dialog: ${dialogs.length ? `OK ("${dialogs[0]}")` : 'FAIL'}`);
// dismissed → master must still be open
const still = await page.getByText(/families ·/).count();
console.log(`dismiss keeps master open: ${still ? 'OK' : 'FAIL'}`);
console.log('console/page errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
