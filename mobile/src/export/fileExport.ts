// Platform file IO for exports. Web triggers a browser download; native writes
// to the document directory and opens the share sheet. PDF uses expo-print.
import { Platform } from 'react-native';

function webDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function saveText(filename: string, text: string, mime: string): Promise<void> {
  if (Platform.OS === 'web') { webDownload(filename, new Blob([text], { type: mime })); return; }
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function saveBase64(filename: string, b64: string, mime: string): Promise<void> {
  if (Platform.OS === 'web') { webDownload(filename, new Blob([b64ToBytes(b64) as unknown as BlobPart], { type: mime })); return; }
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime });
}

// PDF from HTML. Web opens the print dialog (save as PDF); native makes a file + shares.
export async function exportPDF(html: string, filename = 'family-tree.pdf'): Promise<void> {
  const Print = await import('expo-print');
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  const Sharing = await import('expo-sharing');
  const FileSystem = await import('expo-file-system/legacy');
  const dest = FileSystem.documentDirectory + filename;
  try { await FileSystem.moveAsync({ from: uri, to: dest }); } catch { /* fall back to original uri */ }
  const out = (await FileSystem.getInfoAsync(dest)).exists ? dest : uri;
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(out, { mimeType: 'application/pdf' });
}

// Pick a file for import; returns its text (and a name) or null.
export async function pickImportFile(): Promise<{ name: string; text: string; base64: string } | null> {
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/csv', 'text/comma-separated-values', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];

  if (Platform.OS === 'web') {
    // On web the asset carries a uri (blob/data); fetch both text + base64.
    const resp = await fetch(asset.uri);
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    const text = new TextDecoder().decode(bytes);
    return { name: asset.name ?? 'import', text, base64 };
  }
  const FileSystem = await import('expo-file-system/legacy');
  const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => '');
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }).catch(() => '');
  return { name: asset.name ?? 'import', text, base64 };
}
