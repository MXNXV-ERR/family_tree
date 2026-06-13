// Desktop detection for the responsive workspace. Desktop = web at a wide
// viewport; native phones/tablets always use the mobile layout.
import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_MIN_WIDTH = 900;

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
  return { isDesktop, width };
}
