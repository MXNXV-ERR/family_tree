// PNG of a view — NATIVE. Captures the rendered react-native-svg view (the
// SvgXml preview the export panel renders for the selected view).
import { captureRef } from 'react-native-view-shot';
import type { Member, Relationship } from '../shared/types';

// `svg` is ignored on native; the on-screen preview ref is captured instead.
export async function viewToPngDataUri(_svg: string, ref?: unknown): Promise<string> {
  if (!ref) throw new Error('No view to capture');
  return captureRef(ref as any, { format: 'png', quality: 0.92, result: 'data-uri' });
}

export async function treeToPngDataUri(_members: Member[], _relationships: Relationship[], ref?: unknown): Promise<string> {
  return viewToPngDataUri('', ref);
}
