// Shared chrome for the visualizations: segmented view switcher (with proper
// tab spacing — req 11/12), floating zoom buttons, and a bottom focus bar that
// opens the selected member's profile.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, radius } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { initials, lifespan } from '../shared/adjacency';
import type { Member } from '../shared/types';

export function VizSegment({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
      <View style={[styles.seg, { backgroundColor: c.paper, borderColor: c.line }]}>
        {options.map(([k, label]) => {
          const on = value === k;
          return (
            <Pressable key={k} onPress={() => onChange(k)} style={[styles.segBtn, on && { backgroundColor: c.accentSoft }]}>
              <Text style={{ color: on ? c.accent : c.inkSoft, fontWeight: '700', fontSize: 13 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ZoomButtons({ onIn, onOut, onFit }: { onIn: () => void; onOut: () => void; onFit: () => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.zoom}>
      {[['＋', onIn], ['－', onOut], ['◎', onFit]].map(([label, fn], i) => (
        <Pressable key={i} onPress={fn as () => void} style={[styles.zoomBtn, { backgroundColor: c.paper, borderColor: c.line }]}>
          <Text style={{ color: c.inkSoft, fontSize: 18, fontWeight: '600' }}>{label as string}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function FocusBar({ member, onOpen, onClose, extra }: {
  member: Member; onOpen: () => void; onClose: () => void; extra?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.focusWrap} pointerEvents="box-none">
      <GlassSurface rounded={radius.lg} style={{ overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
          <View style={[styles.av, { backgroundColor: member.gender === 'female' ? c.cardF : c.cardM }]}>
            <Text style={{ color: c.inkSoft, fontWeight: '700', fontSize: 12 }}>{initials(member.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }} numberOfLines={1}>{member.name}</Text>
            <Text style={{ color: c.mute, fontSize: 12 }}>{extra ?? lifespan(member)}</Text>
          </View>
          <Pressable onPress={onOpen} style={[styles.openBtn, { backgroundColor: c.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Profile →</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={{ paddingHorizontal: 6 }}>
            <Text style={{ color: c.mute, fontSize: 18 }}>×</Text>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  zoom: { position: 'absolute', right: 12, top: 70, gap: 8 },
  zoomBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  focusWrap: { position: 'absolute', left: 12, right: 12, bottom: 16 },
  av: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  openBtn: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
});
