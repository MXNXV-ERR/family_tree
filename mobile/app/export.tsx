// Export / Import screen (Phase 7). Exports JSON, CSV, Excel, SVG, PNG, PDF
// (directory + tree snapshot). Import parses JSON/CSV/XLSX and merges into the
// current tree, skipping duplicate members (same name + birth date).
import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme, radius, space, font, type Palette } from '../src/theme/theme';
import { GlassSurface } from '../src/theme/GlassSurface';
import { buildAdjacency, lifespan } from '../src/shared/adjacency';
import { layoutPyramid, NODE_W, NODE_H } from '../src/shared/treeLayout';
import { buildJSON, buildCSV, buildXLSXBase64, buildTreeSVG, buildDirectoryHTML, buildCSVTemplate } from '../src/shared/exportData';
import { Icon, type IconName } from '../src/ui/Icon';
import { parseJSON, parseCSV, parseXLSXBase64, planMerge } from '../src/shared/importData';
import { saveText, saveBase64, exportPDF, pickImportFile } from '../src/export/fileExport';
import { treeToPngDataUri } from '../src/export/treeImage';
import { commitMerge } from '../src/firebase/firestore';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function ExportScreen() {
  const { c } = useTheme();
  const { activeTreeId } = useFamily();
  const { members, relationships, treeMetadata } = useFamilyTree(activeTreeId);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const shotRef = useRef<View>(null);
  const treeName = treeMetadata?.name ?? 'Family Tree';

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setStatus(null);
    try { await fn(); setStatus(`${label} ready`); }
    catch (e) { setStatus(`${label} failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120)); }
    finally { setBusy(null); }
  }

  const exporters: { key: string; label: string; icon: IconName; fn: () => Promise<void> }[] = [
    { key: 'json', label: 'JSON', icon: 'file', fn: () => saveText('family-tree.json', buildJSON(members, relationships), 'application/json') },
    { key: 'csv', label: 'CSV', icon: 'grid', fn: () => saveText('family-tree.csv', buildCSV(members, relationships), 'text/csv') },
    { key: 'excel', label: 'Excel', icon: 'grid', fn: () => saveBase64('family-tree.xlsx', buildXLSXBase64(members, relationships), XLSX_MIME) },
    { key: 'svg', label: 'SVG', icon: 'edit', fn: () => saveText('family-tree.svg', buildTreeSVG(members, relationships), 'image/svg+xml') },
    { key: 'png', label: 'PNG', icon: 'image', fn: async () => { const d = await treeToPngDataUri(members, relationships, shotRef.current); await saveBase64('family-tree.png', d.split(',')[1], 'image/png'); } },
    { key: 'pdf', label: 'PDF', icon: 'download', fn: async () => { const img = await treeToPngDataUri(members, relationships, shotRef.current).catch(() => undefined); await exportPDF(buildDirectoryHTML(members, relationships, img, treeName)); } },
  ];

  async function doImport() {
    setBusy('Import'); setStatus(null);
    try {
      const file = await pickImportFile();
      if (!file) { setBusy(null); return; }
      const lower = file.name.toLowerCase();
      const parsed = lower.endsWith('.xlsx') ? parseXLSXBase64(file.base64)
        : lower.endsWith('.csv') ? parseCSV(file.text)
        : parseJSON(file.text);
      const plan = planMerge(members, parsed, relationships);
      if (!plan.newMembers.length && !plan.newRelationships.length) {
        setStatus(`Nothing new to import (${plan.skipped} duplicate${plan.skipped === 1 ? '' : 's'} skipped).`);
      } else if (activeTreeId) {
        const res = await commitMerge(activeTreeId, plan);
        setStatus(`Imported ${res.added} member${res.added === 1 ? '' : 's'}, ${res.links} link${res.links === 1 ? '' : 's'}. Skipped ${plan.skipped} duplicate${plan.skipped === 1 ? '' : 's'}.`);
      }
    } catch (e) {
      setStatus('Import failed: ' + (e instanceof Error ? e.message : String(e)).slice(0, 100));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ color: c.accent, fontWeight: '600' }}>‹ Back</Text></Pressable>
        <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>Export & import</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <TreePreview shotRef={shotRef} members={members} relationships={relationships} c={c} />

        <GlassSurface>
          <View style={{ padding: space(4) }}>
            <Text style={[styles.h, { color: c.mute }]}>EXPORT</Text>
            <View style={styles.grid}>
              {exporters.map((e) => (
                <Pressable key={e.key} disabled={!!busy} onPress={() => run(e.label, e.fn)} style={[styles.cell, { borderColor: c.line, backgroundColor: c.paper, opacity: busy && busy !== e.label ? 0.5 : 1 }]}>
                  {busy === e.label ? <ActivityIndicator color={c.accent} /> : <Icon name={e.icon} size={22} color={c.accent} />}
                  <Text style={{ color: c.ink, fontFamily: font.sansBold, marginTop: 6 }}>{e.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </GlassSurface>

        <GlassSurface>
          <View style={{ padding: space(4) }}>
            <Text style={[styles.h, { color: c.mute }]}>IMPORT</Text>
            <Text style={{ color: c.mute, fontSize: 13, marginBottom: 12 }}>Pick a JSON, CSV or Excel file. New members merge in; duplicates (same name + birth date) are skipped. A plain spreadsheet with a "name" column works too.</Text>
            <Pressable disabled={!!busy} onPress={doImport} style={[styles.importBtn, { borderColor: c.accent, backgroundColor: c.accentSoft, opacity: busy ? 0.6 : 1 }]}>
              {busy === 'Import' ? <ActivityIndicator color={c.accent} /> : <Text style={{ color: c.accent, fontWeight: '800' }}>Choose file to import</Text>}
            </Pressable>
            <Pressable disabled={!!busy} onPress={() => run('Template', () => saveText('family-tree-template.csv', buildCSVTemplate(), 'text/csv'))}
              style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.line }}>
              <Icon name="download" size={16} color={c.inkSoft} />
              <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>Download CSV template</Text>
            </Pressable>
          </View>
        </GlassSurface>

        {status ? (
          <GlassSurface><Text style={{ color: c.inkSoft, padding: 16, textAlign: 'center' }}>{status}</Text></GlassSurface>
        ) : null}
        <Text style={{ color: c.mute, fontSize: 11, textAlign: 'center' }}>
          {Platform.OS === 'web' ? 'Files download to your browser. PDF opens the print dialog (save as PDF).' : 'Files open the share sheet to save or send.'}
        </Text>
      </ScrollView>
    </View>
  );
}

// Small fit-scaled preview of the pyramid tree; doubles as the native PNG capture target.
const TreePreview = ({ shotRef, members, relationships, c }: { shotRef: React.Ref<View>; members: any[]; relationships: any[]; c: Palette }) => {
  const { positions, lines, width, height } = useMemo(() => layoutPyramid(members, buildAdjacency(members, relationships)), [members, relationships]);
  const W = 360, scale = Math.min(1, W / Math.max(1, width));
  const H = Math.min(220, height * scale);
  return (
    <GlassSurface>
      <View ref={shotRef} collapsable={false} style={{ backgroundColor: c.bg, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', padding: 8 }}>
        <Svg width={W} height={H} viewBox={`0 0 ${width} ${height}`}>
          {lines.map((l, i) => <Path key={i} d={l.d} fill="none" stroke={c.accent} strokeWidth={1.5} opacity={0.5} />)}
          {[...positions.entries()].map(([id, p]) => {
            const m = members.find((x) => x.id === id); if (!m) return null;
            return (
              <Rect key={id} x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={12}
                fill={m.gender === 'female' ? c.cardF : c.cardM} stroke={c.line} />
            );
          })}
          {[...positions.entries()].map(([id, p]) => {
            const m = members.find((x) => x.id === id); if (!m) return null;
            return <SvgText key={`t${id}`} x={p.x + 10} y={p.y + 28} fill={c.ink} fontSize={13} fontWeight="700">{String(m.name).slice(0, 14)}</SvgText>;
          })}
        </Svg>
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  h: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '31%', aspectRatio: 1, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  importBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
});
