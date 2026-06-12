// PNG of the tree — NATIVE. Captures the rendered react-native-svg view.
import { captureRef } from 'react-native-view-shot';
import type { Member, Relationship } from '../shared/types';

export async function treeToPngDataUri(_members: Member[], _relationships: Relationship[], ref?: unknown): Promise<string> {
  if (!ref) throw new Error('No view to capture');
  return captureRef(ref as any, { format: 'png', quality: 0.92, result: 'data-uri' });
}
