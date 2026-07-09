// Web-only: how much of the layout viewport the on-screen keyboard (or other
// browser chrome) is currently covering at the bottom. Mobile-web keyboards
// shrink only the VISUAL viewport — neither 100dvh nor flex layout reacts — so
// bottom-pinned inputs (the chat composer) add this as padding to stay visible.
// Returns 0 on native (KeyboardAvoidingView handles it there) and on browsers
// without window.visualViewport.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useViewportInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > 24 ? Math.round(covered) : 0); // ignore sub-URL-bar jitter
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}
