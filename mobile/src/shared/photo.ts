// Photo capture/pick → cropped + compressed base64 data URI, guaranteed under
// 1 MB (also keeps the member document safely below Firestore's 1 MiB limit).
// Native: the system crop UI (allowsEditing) asks the user to crop, then an
// iterative resize/quality loop compresses. Web: asks to crop to a centred
// square, then a canvas resize/quality loop compresses.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_BYTES = 1_000_000;       // hard ceiling (user req: < 1 MB)
const START_DIM = 900;             // initial longest-side target

const b64Bytes = (dataUri: string) => Math.ceil((dataUri.split(',')[1]?.length ?? 0) * 0.75);

// ---------- native: expo-image-manipulator loop ----------
async function compressNative(uri: string): Promise<string> {
  let width = START_DIM;
  for (let pass = 0; pass < 5; pass++) {
    for (const quality of [0.8, 0.65, 0.5, 0.35, 0.2]) {
      const out = await manipulateAsync(uri, [{ resize: { width } }], {
        compress: quality,
        format: SaveFormat.JPEG,
        base64: true,
      });
      const dataUri = `data:image/jpeg;base64,${out.base64}`;
      if (b64Bytes(dataUri) < MAX_BYTES) return dataUri;
    }
    width = Math.round(width * 0.7); // still too big — shrink and retry
  }
  // Last resort: tiny thumbnail (always < 1 MB).
  const out = await manipulateAsync(uri, [{ resize: { width: 320 } }], {
    compress: 0.2, format: SaveFormat.JPEG, base64: true,
  });
  return `data:image/jpeg;base64,${out.base64}`;
}

// ---------- web: canvas crop + quality loop ----------
function loadImg(uri: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = uri;
  });
}

async function compressWeb(uri: string): Promise<string> {
  const img = await loadImg(uri);
  // Ask for the crop (native gets the system crop UI; web offers centre-square).
  const wantCrop =
    img.width !== img.height &&
    typeof window !== 'undefined' &&
    window.confirm('Crop this photo to a centered square? (Cancel keeps the full photo)');

  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (wantCrop) {
    const side = Math.min(img.width, img.height);
    sx = (img.width - side) / 2;
    sy = (img.height - side) / 2;
    sw = sh = side;
  }

  let dim = Math.min(START_DIM, Math.max(sw, sh));
  for (let pass = 0; pass < 5; pass++) {
    const scale = dim / Math.max(sw, sh);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4, 0.25]) {
      const dataUri = canvas.toDataURL('image/jpeg', quality);
      if (b64Bytes(dataUri) < MAX_BYTES) return dataUri;
    }
    dim = Math.round(dim * 0.7);
  }
  // Tiny fallback.
  const canvas = document.createElement('canvas');
  const scale = 320 / Math.max(sw, sh);
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.25);
}

async function process(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    const src = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    return compressWeb(src);
  }
  return compressNative(asset.uri);
}

// Pick from gallery. Crop prompt + <1MB compression. Null if cancelled/denied.
export async function pickFromGallery(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,   // native system crop UI
    aspect: [1, 1],
    quality: 1,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return process(res.assets[0]);
}

// Capture from camera. Crop prompt + <1MB compression. Null if cancelled/denied.
export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return process(res.assets[0]);
}
