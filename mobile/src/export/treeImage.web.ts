// PNG of the tree — WEB. Rasterises the standalone SVG via an offscreen canvas.
import { buildTreeSVG } from '../shared/exportData';
import type { Member, Relationship } from '../shared/types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export async function treeToPngDataUri(members: Member[], relationships: Relationship[], _ref?: unknown): Promise<string> {
  const svg = buildTreeSVG(members, relationships);
  const w = Number(svg.match(/width="(\d+)"/)?.[1] ?? 800);
  const h = Number(svg.match(/height="(\d+)"/)?.[1] ?? 600);
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}
