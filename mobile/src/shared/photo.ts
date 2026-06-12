// Photo capture/pick → resized base64 data URI.
// Replaces the web app's canvas compression with expo-image-picker +
// expo-image-manipulator. Stored inline on the member (photoUrl) like the web app.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_DIM = 500;

async function process(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  // On web, expo-image-manipulator's canvas resize is flaky; the picker already
  // gives us a usable data/blob URI, so use it directly. On native, downscale
  // to keep the inline base64 small.
  if (Platform.OS === 'web') {
    return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
  }
  const out = await manipulateAsync(asset.uri, [{ resize: { width: MAX_DIM } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return `data:image/jpeg;base64,${out.base64}`;
}

// Pick from gallery. Returns a data URI or null if cancelled / denied.
export async function pickFromGallery(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return process(res.assets[0]);
}

// Capture from camera. Returns a data URI or null if cancelled / denied.
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
