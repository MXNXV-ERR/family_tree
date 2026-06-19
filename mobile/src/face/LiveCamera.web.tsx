// Live camera — WEB. expo-camera's takePictureAsync returns a BLACK frame on web,
// so we use getUserMedia + a real <video> and capture frames by drawing the video
// onto a <canvas> (reliable, never black). Exposes the same imperative capture()
// handle as the native version. getUserMedia triggers the browser's own camera
// permission prompt.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface LiveCameraHandle { capture: () => Promise<string | undefined>; }
export interface LiveCameraProps { facing?: 'front' | 'back'; onReady?: () => void; onError?: (msg: string) => void; }

export const LiveCamera = forwardRef<LiveCameraHandle, LiveCameraProps>(({ facing = 'front', onReady, onError }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing === 'front' ? 'user' : 'environment' }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); onReady?.(); }
      } catch (e: any) {
        onError?.(e?.message ? `Camera unavailable: ${String(e.message)}` : 'Could not access the camera.');
      }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [facing]);

  useImperativeHandle(ref, () => ({
    capture: async () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return undefined;
      const scale = Math.min(1, 480 / v.videoWidth);
      const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(v, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.7);
    },
  }));

  return <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
});
LiveCamera.displayName = 'LiveCamera';
