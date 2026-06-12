import { chromium } from 'playwright';
const BASE='http://localhost:8082';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:414,height:896}});
await p.goto(BASE,{waitUntil:'networkidle',timeout:120000});
await p.waitForTimeout(4000);
await p.locator('input').first().fill('jatin75b@gmail.com');
const pw=p.locator('input[type="password"]'); if(await pw.count()) await pw.fill('password');
await p.getByText('Sign In',{exact:true}).click().catch(()=>{});
await p.waitForTimeout(6000);
await p.getByText('🌳',{exact:true}).click().catch(()=>{});
await p.waitForTimeout(4000);
const info = await p.evaluate(()=>{
  const svgs=[...document.querySelectorAll('svg')].map(s=>{const b=s.getBoundingClientRect();return{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};});
  // find element with transform containing scale
  const xf=[...document.querySelectorAll('*')].filter(e=>{const t=getComputedStyle(e).transform;return t&&t!=='none'&&/matrix/.test(t);}).slice(0,6).map(e=>{const b=e.getBoundingClientRect();return{tf:getComputedStyle(e).transform,x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};});
  return {svgs:svgs.slice(0,4), svgCount:svgs.length, xf};
});
console.log(JSON.stringify(info,null,1));
await b.close();
