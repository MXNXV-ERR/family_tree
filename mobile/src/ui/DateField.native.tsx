// Date input — NATIVE (android/iOS). A tappable field that opens the platform
// date picker. Value is YYYY-MM-DD.
import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, radius, font } from '../theme/theme';

export interface DateFieldProps {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  // Birth/death dates cap at today (default); events may lie in the future.
  allowFuture?: boolean;
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DateField({ value, onChange, placeholder, error, allowFuture }: DateFieldProps) {
  const { c } = useTheme();
  const [show, setShow] = useState(false);
  const parsed = value && /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(value) : new Date(2000, 0, 1);
  return (
    <View>
      <Pressable
        onPress={() => setShow(true)}
        style={{ height: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: radius.md, borderColor: error ? c.danger : c.line, backgroundColor: c.paper }}
      >
        <Text style={{ color: value ? c.ink : c.mute, fontFamily: font.sansMed, fontSize: 15 }}>{value || placeholder || 'Select date'}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={parsed}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={allowFuture ? undefined : new Date()}
          onChange={(_e, dte) => { setShow(Platform.OS === 'ios'); if (dte) onChange(toISO(dte)); }}
        />
      ) : null}
    </View>
  );
}
