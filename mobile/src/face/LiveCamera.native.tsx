// Live camera — NATIVE (android/iOS). Wraps expo-camera's CameraView; capture()
// returns a data URI via takePictureAsync. Same handle as the web version.
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { CameraView } from 'expo-camera';

export interface LiveCameraHandle { capture: () => Promise<string | undefined>; }
export interface LiveCameraProps { facing?: 'front' | 'back'; onReady?: () => void; onError?: (msg: string) => void; }

export const LiveCamera = forwardRef<LiveCameraHandle, LiveCameraProps>(({ facing = 'front', onReady }, ref) => {
  const cam = useRef<CameraView>(null);
  useImperativeHandle(ref, () => ({
    capture: async () => {
      const pic = await cam.current?.takePictureAsync({ quality: 0.6, base64: true, skipProcessing: true });
      return pic?.base64 ? `data:image/jpg;base64,${pic.base64}` : pic?.uri;
    },
  }));
  return <CameraView ref={cam} style={{ flex: 1 }} facing={facing} onCameraReady={onReady} />;
});
LiveCamera.displayName = 'LiveCamera';
