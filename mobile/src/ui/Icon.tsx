// Line-icon set ported from the design bundle (1.7 stroke, round caps).
// Replaces every emoji in the app. <Icon name="search" size={20} color={...} />
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName =
  | 'search' | 'settings' | 'tune' | 'users' | 'user' | 'link' | 'plus' | 'minus'
  | 'share' | 'download' | 'upload' | 'moon' | 'sun' | 'sparkles' | 'scan'
  | 'chevR' | 'chevL' | 'chevD' | 'close' | 'target' | 'edit' | 'phone' | 'mail'
  | 'pin' | 'back' | 'tree' | 'radial' | 'timeline' | 'home' | 'grid' | 'menu'
  | 'camera' | 'heart' | 'check' | 'filter' | 'branch' | 'ring' | 'zoomIn'
  | 'zoomOut' | 'send' | 'copy' | 'logout' | 'calendar' | 'globe' | 'briefcase'
  | 'cake' | 'quote' | 'flower' | 'info' | 'image' | 'trash' | 'file';

const PATHS: Record<IconName, React.ReactNode> = {
  search: <><Circle cx={11} cy={11} r={7} /><Path d="M20 20l-3.2-3.2" /></>,
  settings: <><Path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><Circle cx={12} cy={12} r={3} /></>,
  tune: <><Path d="M4 7h16M4 12h16M4 17h16" /><Circle cx={15} cy={7} r={2.6} fill="currentColor" stroke="none" /><Circle cx={9} cy={12} r={2.6} fill="currentColor" stroke="none" /><Circle cx={17} cy={17} r={2.6} fill="currentColor" stroke="none" /></>,
  users: <><Circle cx={9} cy={9} r={3.4} /><Path d="M3.5 19c0-3 2.6-5 5.5-5s5.5 2 5.5 5" /><Path d="M16 6.2a3.2 3.2 0 010 6" /><Path d="M17.5 14.2c2.3.5 3.9 2.3 3.9 4.8" /></>,
  user: <><Circle cx={12} cy={8.5} r={3.8} /><Path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  link: <><Path d="M10 14a4 4 0 005.7 0l2.6-2.6a4 4 0 00-5.7-5.7L11 7.3" /><Path d="M14 10a4 4 0 00-5.7 0L5.7 12.6a4 4 0 005.7 5.7L13 16.7" /></>,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  share: <><Path d="M12 15V4M12 4L8.5 7.5M12 4l3.5 3.5" /><Path d="M5 13v4.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V13" /></>,
  download: <><Path d="M12 4v11M12 15l-3.5-3.5M12 15l3.5-3.5" /><Path d="M5 16v1.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V16" /></>,
  upload: <><Path d="M12 15V4M12 4L8.5 7.5M12 4l3.5 3.5" /><Path d="M5 16v1.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V16" /></>,
  moon: <Path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  sun: <><Circle cx={12} cy={12} r={4} /><Path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6" /></>,
  sparkles: <><Path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" /><Path d="M18.5 4.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  scan: <><Path d="M4 8V6.5A2.5 2.5 0 016.5 4H8M16 4h1.5A2.5 2.5 0 0120 6.5V8M20 16v1.5a2.5 2.5 0 01-2.5 2.5H16M8 20H6.5A2.5 2.5 0 014 17.5V16" /><Circle cx={12} cy={11} r={2.3} /><Path d="M8.5 16c.6-1.7 1.9-2.5 3.5-2.5s2.9.8 3.5 2.5" /></>,
  chevR: <Path d="M9 5l7 7-7 7" />,
  chevL: <Path d="M15 5l-7 7 7 7" />,
  chevD: <Path d="M5 9l7 7 7-7" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  target: <><Circle cx={12} cy={12} r={7.5} /><Circle cx={12} cy={12} r={2.4} /><Path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3" /></>,
  edit: <Path d="M14.5 5.5l4 4M4 20l1-4L16 5a2.1 2.1 0 013 3L8 19l-4 1z" />,
  phone: <Path d="M6.5 4h3l1.5 4-2 1.3a11 11 0 005 5l1.3-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 6.2 2 2 0 016.5 4z" />,
  mail: <><Rect x={3.5} y={5.5} width={17} height={13} rx={2.4} /><Path d="M4.5 7.5l7.5 5 7.5-5" /></>,
  pin: <><Path d="M12 21c4-4.5 6.5-7.7 6.5-11A6.5 6.5 0 005.5 10c0 3.3 2.5 6.5 6.5 11z" /><Circle cx={12} cy={10} r={2.4} /></>,
  back: <Path d="M19 12H5M5 12l6-6M5 12l6 6" />,
  tree: <><Rect x={9} y={3.5} width={6} height={4.5} rx={1.4} /><Rect x={3.5} y={15.5} width={6} height={4.5} rx={1.4} /><Rect x={14.5} y={15.5} width={6} height={4.5} rx={1.4} /><Path d="M12 8v3.5M6.5 15.5V13a1 1 0 011-1h9a1 1 0 011 1v2.5" /></>,
  radial: <><Circle cx={12} cy={12} r={2.6} /><Circle cx={12} cy={3.8} r={1.8} /><Circle cx={19.2} cy={16} r={1.8} /><Circle cx={4.8} cy={16} r={1.8} /><Path d="M12 9.4V5.6M13.6 13.4l4 2M10.4 13.4l-4 2" /></>,
  timeline: <><Path d="M4 12h16" /><Circle cx={7} cy={12} r={2} /><Circle cx={13} cy={12} r={2} /><Circle cx={19} cy={12} r={1.6} /><Path d="M7 10V6M13 14v4" /></>,
  home: <><Path d="M4 11l8-6.5 8 6.5" /><Path d="M6 9.5V19a1 1 0 001 1h10a1 1 0 001-1V9.5" /><Path d="M10 20v-5h4v5" /></>,
  grid: <><Rect x={4} y={4} width={7} height={7} rx={1.6} /><Rect x={13} y={4} width={7} height={7} rx={1.6} /><Rect x={4} y={13} width={7} height={7} rx={1.6} /><Rect x={13} y={13} width={7} height={7} rx={1.6} /></>,
  menu: <Path d="M4 7h16M4 12h16M4 17h16" />,
  camera: <><Path d="M4.5 8.5A1.5 1.5 0 016 7h1.5l1-1.8h5L14.5 7H18a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0118 18H6a1.5 1.5 0 01-1.5-1.5z" /><Circle cx={12} cy={12.2} r={3} /></>,
  heart: <Path d="M12 19.5l-7-6.6A4.3 4.3 0 0112 6.8a4.3 4.3 0 017 6.1z" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7" />,
  filter: <Path d="M4 6h16M7 12h10M10 18h4" />,
  branch: <><Circle cx={6} cy={6} r={2.2} /><Circle cx={6} cy={18} r={2.2} /><Circle cx={18} cy={9} r={2.2} /><Path d="M6 8.2v7.6M8.2 6h4a2 2 0 012 2v.8" /></>,
  ring: <><Circle cx={12} cy={13.5} r={5} /><Path d="M9.5 8.5L8 5h8l-1.5 3.5" /></>,
  zoomIn: <><Circle cx={11} cy={11} r={6.5} /><Path d="M20 20l-3-3M11 8.5v5M8.5 11h5" /></>,
  zoomOut: <><Circle cx={11} cy={11} r={6.5} /><Path d="M20 20l-3-3M8.5 11h5" /></>,
  send: <><Path d="M4.5 12L20 4.5 16 20l-4.5-5.5L4.5 12z" /><Path d="M11.5 14.5L20 4.5" /></>,
  copy: <><Rect x={8} y={8} width={11} height={11} rx={2.2} /><Path d="M5 16V6.2A2.2 2.2 0 017.2 4H16" /></>,
  logout: <><Path d="M14 5H7a2 2 0 00-2 2v10a2 2 0 002 2h7" /><Path d="M16 12H10M16 12l-2.8-2.8M16 12l-2.8 2.8" /></>,
  calendar: <><Rect x={4} y={5.5} width={16} height={14.5} rx={2.4} /><Path d="M4 9.5h16M8 3.5v3.5M16 3.5v3.5" /></>,
  globe: <><Circle cx={12} cy={12} r={8} /><Path d="M4 12h16M12 4c2.4 2 2.4 14 0 16M12 4c-2.4 2-2.4 14 0 16" /></>,
  briefcase: <><Rect x={3.5} y={7.5} width={17} height={12} rx={2.2} /><Path d="M8.5 7.5V6a2 2 0 012-2h3a2 2 0 012 2v1.5M3.5 12.5h17" /></>,
  cake: <><Path d="M4 20h16M5 20v-6a2 2 0 012-2h10a2 2 0 012 2v6" /><Path d="M5 15c1.2.9 2.3.9 3.5 0s2.3-.9 3.5 0 2.3.9 3.5 0 2.3-.9 3.5 0M12 8.5V12M12 6.5a1 1 0 11-1.4 1.4A4 4 0 0112 6.5z" /></>,
  quote: <Path d="M9 7c-2.5 1-4 3-4 6h3a2 2 0 010 4H5a2 2 0 01-2-2v-2c0-3.5 2-6 6-7zM20 7c-2.5 1-4 3-4 6h3a2 2 0 010 4h-3a2 2 0 01-2-2v-2c0-3.5 2-6 6-7z" />,
  flower: <><Circle cx={12} cy={12} r={2.2} /><Path d="M12 9.8C12 7 13 5.5 14.8 5.5S17 7.5 16 9.4M12 14.2C12 17 11 18.5 9.2 18.5S7 16.5 8 14.6M9.8 12C7 12 5.5 11 5.5 9.2S7.5 7 9.4 8M14.2 12c2.8 0 4.3 1 4.3 2.8S16.5 17 14.6 16" /></>,
  info: <><Circle cx={12} cy={12} r={8} /><Path d="M12 11v5M12 8.2v.1" /></>,
  image: <><Rect x={3.5} y={4.5} width={17} height={15} rx={2.4} /><Circle cx={9} cy={10} r={1.8} /><Path d="M3.5 16.5l4.5-4 4 3.5 3.5-3 5 4" /></>,
  trash: <><Path d="M4.5 6.5h15M9.5 6V4.8A1.3 1.3 0 0110.8 3.5h2.4a1.3 1.3 0 011.3 1.3V6" /><Path d="M6.5 6.5l.8 12A2 2 0 009.3 20.5h5.4a2 2 0 002-1.9l.8-12.1" /><Path d="M10 10.5v6M14 10.5v6" /></>,
  file: <><Path d="M6 3.5h8l4 4V19a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19z" /><Path d="M14 3.5V8h4.5M9 12.5h6M9 16h6" /></>,
};

export function Icon({
  name,
  size = 22,
  stroke = 1.7,
  color = 'currentColor',
  style,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  style?: object;
}) {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color={color}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style as any}
    >
      {p}
    </Svg>
  );
}
