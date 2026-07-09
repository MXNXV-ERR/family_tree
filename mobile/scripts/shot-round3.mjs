// Round-3 checks: tree FocusBar tap-race fix, line draw-on frames, radial spoke
// endpoints (screenshot), desktop order-sheet pinned Save, Master Edit Age-order
// tab, radial default selection after view roundtrip.
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

// ---- 1) TREE: line draw-on frames + FocusBar on node tap ----
await page.getByText('Tree', { exact: true }).first().click();
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(i === 0 ? 250 : 350);
  await page.screenshot({ path: `${out}/r3-tree-draw-f${i}.png` });
}
await page.waitForTimeout(1500);
// tap a node card (the YOU badge's card or any name text inside the canvas)
const card = page.getByText('YOU', { exact: true }).first();
if (await card.count()) {
  await card.click();
  await page.waitForTimeout(900);
  const bar = await page.getByText('Profile →', { exact: true }).count();
  console.log(`tree FocusBar after node tap: ${bar > 0 ? 'OK' : 'FAIL'}`);
  await page.waitForTimeout(700);
  const barStill = await page.getByText('Profile →', { exact: true }).count();
  console.log(`tree FocusBar persists >1.5s: ${barStill > 0 ? 'OK' : 'FAIL'}`);
  await page.screenshot({ path: `${out}/r3-tree-focusbar.png` });
} else console.log('tree: YOU card not found — skipped FocusBar check');

// ---- 2) RADIAL: default selection + endpoints + roundtrip ----
await page.getByText('Radial', { exact: true }).first().click();
await page.waitForTimeout(3000);
let bar = await page.getByText('Profile →', { exact: true }).count();
console.log(`radial FocusBar on entry: ${bar > 0 ? 'OK' : 'FAIL'}`);
await page.screenshot({ path: `${out}/r3-radial-endpoints.png` });
// clear selection, roundtrip to Tree and back — selection must re-seed
await page.mouse.click(80, 700);
await page.waitForTimeout(600);
await page.getByText('Tree', { exact: true }).first().click();
await page.waitForTimeout(1500);
await page.getByText('Radial', { exact: true }).first().click();
await page.waitForTimeout(2500);
bar = await page.getByText('Profile →', { exact: true }).count();
console.log(`radial FocusBar re-seeded after roundtrip: ${bar > 0 ? 'OK' : 'FAIL'}`);

// ---- 2b) big-stage overflow: crank depth to max, page must NOT grow ----
const depthLbl = await page.getByText('Depth', { exact: true }).first().boundingBox();
if (depthLbl) {
  await page.mouse.click(depthLbl.x + depthLbl.width + 10 + 86, depthLbl.y + depthLbl.height / 2); // slider max
  await page.waitForTimeout(2500);
}
const oh = await page.evaluate(() => ({
  root: document.getElementById('root')?.scrollHeight ?? 0,
  body: document.body.scrollHeight,
  win: window.innerHeight,
}));
console.log(`page height bounded at max depth: ${oh.root <= oh.win + 1 && oh.body <= oh.win + 1 ? 'OK' : 'FAIL'} (root=${oh.root} body=${oh.body} win=${oh.win})`);
bar = await page.getByText('Profile →', { exact: true }).count();
const barBox = bar ? await page.getByText('Profile →', { exact: true }).first().boundingBox() : null;
console.log(`FocusBar inside viewport at max depth: ${barBox && barBox.y + barBox.height <= 900 ? 'OK' : bar === 0 ? 'SKIP (no bar)' : 'FAIL'}`);

// ---- 3) desktop order sheet: pinned Save inside viewport ----
const profileBtn = page.getByText('Profile →', { exact: true }).first();
if (await profileBtn.count()) {
  await profileBtn.click();
  await page.waitForTimeout(2200);
  const orderBtn = page.getByText('Order', { exact: true }).first();
  if (await orderBtn.count()) {
    await orderBtn.click();
    await page.waitForTimeout(1500);
    const save = page.getByText('Save order', { exact: true }).first();
    const box = await save.boundingBox();
    console.log(`order sheet Save visible without scroll: ${box && box.y + box.height <= 900 ? 'OK' : 'FAIL'} (bottom=${box ? Math.round(box.y + box.height) : 'n/a'})`);
    await page.screenshot({ path: `${out}/r3-order-save.png` });
    // close drawer
    await page.mouse.click(300, 450);
    await page.waitForTimeout(800);
  } else console.log('Order button not found — skipped');
} else console.log('profile entry not found — skipped order-sheet check');

// ---- 4) Master Edit: Age order tab ----
// open family info panel via the family chip, then "Edit all members"
await page.mouse.click(300, 450); // ensure drawers closed
await page.waitForTimeout(500);
const editAll = page.getByText('Edit all members', { exact: true }).first();
if (!(await editAll.count())) {
  // family info panel opens from the family switcher chip (top-left toolbar)
  await page.mouse.click(120, 30);
  await page.waitForTimeout(1500);
}
if (await page.getByText('Edit all members', { exact: true }).count()) {
  await page.getByText('Edit all members', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  const tab = page.getByText('Age order', { exact: true }).first();
  if (await tab.count()) {
    await tab.click();
    await page.waitForTimeout(1200);
    const gen = await page.getByText(/Generation 1/i).count();
    console.log(`master-edit Age order tab shows generation groups: ${gen > 0 ? 'OK' : 'FAIL'}`);
    await page.screenshot({ path: `${out}/r3-master-order.png` });
  } else console.log('Age order tab not found — FAIL');
} else console.log('Edit all members entry not found — skipped master-edit check');

console.log('console/page errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
