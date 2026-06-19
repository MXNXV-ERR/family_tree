// Date input — WEB. react-native-web renders to the DOM, so a real
// <input type="date"> gives the native browser date picker. colorScheme keeps
// the calendar icon visible in dark mode. Value is YYYY-MM-DD (same as the rest
// of the app's date strings).
import { useTheme, radius } from '../theme/theme';

export interface DateFieldProps {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
}

export function DateField({ value, onChange, error }: DateFieldProps) {
  const { c, mode } = useTheme();
  return (
    // Raw DOM <input> — valid on web (react-native-web renders to the DOM).
    <input
      type="date"
      value={value || ''}
      max={new Date().toISOString().slice(0, 10)}
      onChange={(e: any) => onChange(e.target.value)}
      style={{
        height: 44,
        padding: '0 12px',
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: radius.md,
        border: `1px solid ${error ? c.danger : c.line}`,
        background: c.paper,
        color: c.ink,
        fontSize: 15,
        outline: 'none',
        colorScheme: mode === 'dark' ? 'dark' : 'light',
      } as any}
    />
  );
}
