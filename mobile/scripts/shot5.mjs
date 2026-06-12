// Phase 5 check: drive the Face match upload flow on web and confirm the tfjs
// engine runs (progress phases → a terminal result). Generates a valid JPEG via
// an offscreen browser canvas so the picker/engine get real image bytes.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:8082';
const out = 'scripts/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Unknown event handler/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

await page.goto(BASE, { timeout: 120000 });
await page.waitForSelector('input', { timeout: 120000 });

// Generate a valid 256x256 JPEG with a face-ish blob, save to disk.
const dataUrl = await page.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = '#caa'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#e8c0a0'; x.beginPath(); x.ellipse(128, 130, 70, 90, 0, 0, 7); x.fill();
  x.fillStyle = '#222'; x.beginPath(); x.ellipse(104, 115, 9, 6, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(152, 115, 9, 6, 0, 0, 7); x.fill();
  x.fillStyle = '#a55'; x.fillRect(112, 165, 32, 8);
  return cv.toDataURL('image/jpeg', 0.9);
});
fs.writeFileSync('scripts/testface.jpg', Buffer.from(dataUrl.split(',')[1], 'base64'));

await page.locator('input').first().fill('jatin75b@gmail.com');
const pwd = page.locator('input[type="password"]'); if (await pwd.count()) await pwd.fill('password');
await page.getByText('Sign In', { exact: true }).click().catch(() => {});
await page.waitForTimeout(6000);

await page.getByText('🔍', { exact: true }).click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/p5-screen.png` });

const [fc] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
  page.getByText('Pick a photo to match', { exact: false }).click().catch(() => {}),
]);
if (fc) await fc.setFiles('scripts/testface.jpg');
else { const fi = page.locator('input[type="file"]'); if (await fi.count()) await fi.setInputFiles('scripts/testface.jpg'); }

let last = '';
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(2000);
  const txt = await page.locator('body').innerText().catch(() => '');
  const m = txt.match(/(Starting|Loading detector|Loading recognizer|Indexing[^\n]*|Analysing face|Comparing|No face detected|No members have photos|Engine error[^\n]*|BEST MATCHES)/);
  if (m && m[1] !== last) { last = m[1]; console.log('phase:', m[1]); }
  if (/BEST MATCHES|No face detected|No members have photos|Engine error/.test(txt)) break;
}
await page.screenshot({ path: `${out}/p5-result.png`, fullPage: true });
console.log('final:', last || '(none)', '| errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
