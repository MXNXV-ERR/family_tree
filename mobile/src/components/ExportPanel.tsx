// Shared export / import panel — used by the mobile /export route AND the
// desktop workspace drawer (parity: same functionality, only the shell differs).
// A view picker (Tree · Radial · Timeline) drives the image exports (SVG/PNG/PDF)
// via a single standalone SVG per view (buildViewSVG), rendered with SvgXml so it
// captures identically on web + native. Data exports (JSON/CSV/Excel) are
// view-independent. Import merges JSON/CSV/XLSX, skipping duplicates.
import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTheme, radius, space, font, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { SheetHead } from './panelChrome';
import { Icon, type IconName } from '../ui/Icon';
import { buildJSON, buildCSV, buildXLSXBase64, buildViewSVG, buildDirectoryHTML, buildCSVTemplate, type ExportView } from '../shared/exportData';
import { parseJSON, parseCSV, parseXLSXBase64, planMerge } from '../shared/importData';
import { saveText, saveBase64, exportPDF, pickImportFile } from '../export/fileExport';
import { viewToPngDataUri } from '../export/treeImage';
import { commitMerge } from '../firebase/firestore';
import type { Member, Relationship } from '../shared/types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function ExportPanel({ treeId, members, relationships, treeName = 'Family Tree', focusId, canImport = true, onClose }: {
  treeId: string | null;
  members: Member[];
  relationships: Relationship[];
  treeName?: string;
  focusId?: string;
  canImport?: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [view, setView] = useState<ExportView>('tree');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const shotRef = useRef<View>(null);

  const svg = useMemo(() => buildViewSVG(view, members, relationships, focusId, 1), [view, members, relationships, focusId]);
  const dim = useMemo(() => {
    const w = Number(svg.match(/width="(\d+)"/)?.[1] ?? 360);
    const h = Number(svg.match(/height="(\d+)"/)?.[1] ?? 200);
    const s = Math.min(1, 540 / w);
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }, [svg]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setStatus(null);
    try { await fn(); setStatus(`${label} ready`); }
    catch (e) { setStatus(`${label} failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120)); }
    finally { setBusy(null); }
  }

  const exporters: { key: string; label: string; icon: IconName; view?: boolean; fn: () => Promise<void> }[] = [
    { key: 'json', label: 'JSON', icon: 'file', fn: () => saveText('family-tree.json', buildJSON(members, relationships), 'application/json') },
    { key: 'csv', label: 'CSV', icon: 'grid', fn: () => saveText('family-tree.csv', buildCSV(members, relationships), 'text/csv') },
    { key: 'excel', label: 'Excel', icon: 'grid', fn: () => saveBase64('family-tree.xlsx', buildXLSXBase64(members, relationships), XLSX_MIME) },
    { key: 'svg', label: 'SVG', icon: 'edit', view: true, fn: () => saveText(`family-tree-${view}.svg`, svg, 'image/svg+xml') },
    { key: 'png', label: 'PNG', icon: 'image', view: true, fn: async () => { const d = await viewToPngDataUri(svg, shotRef.current); await saveBase64(`family-tree-${view}.png`, d.split(',')[1], 'image/png'); } },
    { key: 'pdf', label: 'PDF', icon: 'download', view: true, fn: async () => { const img = await viewToPngDataUri(svg, shotRef.current).catch(() => undefined); await exportPDF(buildDirectoryHTML(members, relationships, img, treeName)); } },
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
      } else if (treeId) {
        const res = await commitMerge(treeId, plan);
        setStatus(`Imported ${res.added} member${res.added === 1 ? '' : 's'}, ${res.links} link${res.links === 1 ? '' : 's'}. Skipped ${plan.skipped} duplicate${plan.skipped === 1 ? '' : 's'}.`);
      }
    } catch (e) {
      setStatus('Import failed: ' + (e instanceof Error ? e.message : String(e)).slice(0, 100));
    } finally {
      setBusy(null);
    }
  }

  const views: [ExportView, string, IconName][] = [['tree', 'Tree', 'tree'], ['radial', 'Radial', 'radial'], ['timeline', 'Timeline', 'timeline']];

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="download" title="Export & import" sub={treeName} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}>
        {/* view picker — drives the image exports */}
        <View style={{ flexDirection: 'row', padding: 4, gap: 2, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
          {views.map(([k, lb, ic]) => {
            const on = view === k;
            return (
              <Pressable key={k} onPress={() => setView(k)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: on ? c.accent : 'transparent', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <Icon name={ic} size={15} stroke={1.8} color={on ? c.accentInk : c.inkSoft} />
                <Text style={{ color: on ? c.accentInk : c.inkSoft, fontFamily: font.sansSemi, fontSize: 13 }}>{lb}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* live preview = the exact SVG that PNG/SVG/PDF capture */}
        <GlassSurface>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
            <View ref={shotRef} collapsable={false} style={{ borderRadius: radius.md, overflow: 'hidden' }}>
              <SvgXml xml={svg} width={dim.w} height={dim.h} />
            </View>
          </ScrollView>
        </GlassSurface>

        <GlassSurface>
          <View style={{ padding: space(4) }}>
            <Text style={[styles.h, { color: c.mute }]}>EXPORT</Text>
            <View style={styles.grid}>
              {exporters.map((e) => (
                <Pressable key={e.key} disabled={!!busy} onPress={() => run(e.label, e.fn)} style={[styles.cell, { borderColor: c.line, backgroundColor: c.paper, opacity: busy && busy !== e.label ? 0.5 : 1 }]}>
                  {busy === e.label ? <ActivityIndicator color={c.accent} /> : <Icon name={e.icon} size={22} color={c.accent} />}
                  <Text style={{ color: c.ink, fontFamily: font.sansBold, marginTop: 6 }}>{e.label}</Text>
                  {e.view ? <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 8.5, marginTop: 2, textTransform: 'capitalize' }}>{view}</Text> : null}
                </Pressable>
              ))}
            </View>
            <Text style={{ color: c.mute, fontSize: 11.5, marginTop: 10 }}>SVG · PNG · PDF use the selected view above. JSON · CSV · Excel export the full dataset.</Text>
          </View>
        </GlassSurface>

        {canImport ? (
          <GlassSurface>
            <View style={{ padding: space(4) }}>
              <Text style={[styles.h, { color: c.mute }]}>IMPORT</Text>
              <Text style={{ color: c.mute, fontSize: 13, marginBottom: 12 }}>Pick a JSON, CSV or Excel file. New members merge in; duplicates (same name + birth date) are skipped. See the import format guide for relationship columns.</Text>
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
        ) : null}

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

const styles = StyleSheet.create({
  h: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '31%', aspectRatio: 1, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  importBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
});
