// Verify the Scan camera captures a NON-BLACK frame, using a fake webcam.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const p = await b.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); });
p.on('pageerror', (e) => errs.push('PE ' + String(e).slice(0, 180)));
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(3500);
await p.locator('input').first().fill('jatin75b@gmail.com');
const pwd = p.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
await p.getByText('Sign In', { exact: true }).click().catch(() => {});
await p.waitForTimeout(7000);
// go to Face match
await p.getByText('Face match', { exact: false }).first().click().catch(() => {});
await p.waitForTimeout(2500);
await p.getByText('scan', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/cam-livepreview.png` });
await p.getByText('Start scanning', { exact: false }).first().click().catch(() => {});
await p.waitForTimeout(6000); // build descriptors + start loop
await p.getByText('Capture now', { exact: false }).first().click().catch(() => {});
await p.waitForTimeout(3500);
await p.screenshot({ path: `${out}/cam-frozen.png` });
console.log('Discard btn present:', await p.getByText('Discard & scan again', { exact: false }).count());
console.log('errors:', errs.length ? errs.slice(0, 6) : 'none');
await b.close();
