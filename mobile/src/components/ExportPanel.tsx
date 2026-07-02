// Shared export / import panel — used by the mobile /export route AND the
// desktop workspace drawer (parity: same functionality, only the shell differs).
// A view picker (Tree · Radial · Timeline · Network) + Light/Dark theme toggle
// drive the image exports (SVG/PNG/PDF) via a single standalone SVG per view
// (buildViewSVG), rendered with SvgXml so it captures identically on web +
// native. Radial exports get a centre-person picker + ring-depth slider. PDF is
// a designed booklet: cover + all four view pages + generation directory.
// Data exports (JSON/CSV/Excel/GEDCOM) are view-independent. Import merges
// JSON/CSV/XLSX/GEDCOM, skipping duplicates.
import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTheme, radius, space, font, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { SheetHead } from './panelChrome';
import { Icon, type IconName } from '../ui/Icon';
import { Slider } from '../ui/Slider';
import { Avatar } from '../ui/primitives';
import {
  buildJSON, buildCSV, buildXLSXBase64, buildViewSVG, buildBookletHTML, buildCSVTemplate,
  type ExportView, type ExportTheme, type BookletSection,
} from '../shared/exportData';
import { parseJSON, parseCSV, parseXLSXBase64, planMerge } from '../shared/importData';
import { buildGEDCOM, parseGEDCOM } from '../shared/gedcom';
import { saveText, saveBase64, exportPDF, pickImportFile } from '../export/fileExport';
import { viewToPngDataUri } from '../export/treeImage';
import { commitMerge } from '../firebase/firestore';
import type { Member, Relationship } from '../shared/types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const VIEW_META: Record<ExportView, { label: string; desc: string }> = {
  tree: { label: 'Family tree', desc: 'Generations stacked as a pyramid, parents above children.' },
  radial: { label: 'Kinship rings', desc: 'Everyone placed by distance from the centre person.' },
  timeline: { label: 'Timeline', desc: 'Every lifespan as a bar across the decades.' },
  network: { label: 'Relationship network', desc: 'The whole family as a force-directed graph of links.' },
};

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
  const [exTheme, setExTheme] = useState<ExportTheme>('light');
  const [centerId, setCenterId] = useState<string | undefined>(undefined); // radial centre; falls back to app focus
  const [depth, setDepth] = useState(2);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickQ, setPickQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const shotRef = useRef<View>(null);

  const radialCenter = centerId ?? focusId ?? members[0]?.id;
  const centerName = members.find((m) => m.id === radialCenter)?.name ?? '—';

  const svg = useMemo(
    () => buildViewSVG(view, members, relationships, { focusId: radialCenter, depth, theme: exTheme }),
    [view, members, relationships, radialCenter, depth, exTheme],
  );
  const dim = useMemo(() => {
    const w = Number(svg.match(/width="(\d+)"/)?.[1] ?? 360);
    const h = Number(svg.match(/height="(\d+)"/)?.[1] ?? 200);
    const s = Math.min(1, 540 / w);
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }, [svg]);

  const matches = pickQ.trim()
    ? members.filter((m) => m.name.toLowerCase().includes(pickQ.trim().toLowerCase())).slice(0, 6)
    : members.slice(0, 6);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setStatus(null);
    try { await fn(); setStatus(`${label} ready`); }
    catch (e) { setStatus(`${label} failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120)); }
    finally { setBusy(null); }
  }

  // The booklet gets all four views in the chosen theme (radial uses the
  // selected centre + depth) — vector SVG pages, no rasterisation.
  const buildBooklet = () => {
    const sections: BookletSection[] = (['tree', 'radial', 'timeline', 'network'] as ExportView[]).map((v) => ({
      label: VIEW_META[v].label,
      desc: VIEW_META[v].desc,
      svg: buildViewSVG(v, members, relationships, { focusId: radialCenter, depth, theme: exTheme }),
    }));
    return buildBookletHTML(members, relationships, treeName, sections);
  };

  const exporters: { key: string; label: string; icon: IconName; view?: boolean; fn: () => Promise<void> }[] = [
    { key: 'json', label: 'JSON', icon: 'file', fn: () => saveText('family-tree.json', buildJSON(members, relationships), 'application/json') },
    { key: 'csv', label: 'CSV', icon: 'grid', fn: () => saveText('family-tree.csv', buildCSV(members, relationships), 'text/csv') },
    { key: 'excel', label: 'Excel', icon: 'grid', fn: () => saveBase64('family-tree.xlsx', buildXLSXBase64(members, relationships), XLSX_MIME) },
    { key: 'gedcom', label: 'GEDCOM', icon: 'share', fn: () => saveText('family-tree.ged', buildGEDCOM(members, relationships, treeName), 'text/plain') },
    { key: 'svg', label: 'SVG', icon: 'edit', view: true, fn: () => saveText(`family-tree-${view}.svg`, svg, 'image/svg+xml') },
    { key: 'png', label: 'PNG', icon: 'image', view: true, fn: async () => { const d = await viewToPngDataUri(svg, shotRef.current); await saveBase64(`family-tree-${view}.png`, d.split(',')[1], 'image/png'); } },
    { key: 'pdf', label: 'PDF booklet', icon: 'download', fn: () => exportPDF(buildBooklet(), 'family-booklet.pdf') },
  ];

  async function doImport() {
    setBusy('Import'); setStatus(null);
    try {
      const file = await pickImportFile();
      if (!file) { setBusy(null); return; }
      const lower = file.name.toLowerCase();
      const parsed = lower.endsWith('.xlsx') ? parseXLSXBase64(file.base64)
        : lower.endsWith('.csv') ? parseCSV(file.text)
        : lower.endsWith('.ged') || lower.endsWith('.gedcom') ? parseGEDCOM(file.text)
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

  const views: [ExportView, string, IconName][] = [['tree', 'Tree', 'tree'], ['radial', 'Radial', 'radial'], ['timeline', 'Timeline', 'timeline'], ['network', 'Network', 'link']];
  const themes: [ExportTheme, string, IconName][] = [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']];

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="download" title="Export & import" sub={treeName} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}>
        {/* view + theme pickers — drive the image exports */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', padding: 4, gap: 2, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.pill }}>
            {views.map(([k, lb, ic]) => {
              const on = view === k;
              return (
                <Pressable key={k} onPress={() => setView(k)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: on ? c.accent : 'transparent', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <Icon name={ic} size={14} stroke={1.8} color={on ? c.accentInk : c.inkSoft} />
                  <Text style={{ color: on ? c.accentInk : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>{lb}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', padding: 4, gap: 2, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.pill }}>
            {themes.map(([k, lb, ic]) => {
              const on = exTheme === k;
              return (
                <Pressable key={k} onPress={() => setExTheme(k)} accessibilityRole="button" accessibilityLabel={`theme ${lb}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: on ? c.accentSoft : 'transparent', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <Icon name={ic} size={14} stroke={1.8} color={on ? c.accent : c.inkSoft} />
                  <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>{lb}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* radial controls — centre person + ring depth */}
        {view === 'radial' ? (
          <GlassSurface rounded={radius.lg}>
            <View style={{ padding: 12, gap: 10 }}>
              <Pressable onPress={() => { setPickOpen((o) => !o); setPickQ(''); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Centre</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.accentSoft }}>
                  <Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 12.5 }}>{centerName}</Text>
                  <Icon name={pickOpen ? 'chevD' : 'chevR'} size={13} color={c.accent} />
                </View>
              </Pressable>
              {pickOpen ? (
                <View style={{ gap: 6 }}>
                  <TextInput value={pickQ} onChangeText={setPickQ} placeholder="Search person…" placeholderTextColor={c.mute}
                    style={{ height: 40, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 13.5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
                  {matches.map((m) => (
                    <Pressable key={m.id} onPress={() => { setCenterId(m.id); setPickOpen(false); }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 7, borderRadius: radius.sm, backgroundColor: pressed || m.id === radialCenter ? c.accentSoft : 'transparent' })}>
                      <Avatar m={m} size={26} />
                      <Text numberOfLines={1} style={{ flex: 1, color: c.ink, fontFamily: font.sansSemi, fontSize: 13 }}>{m.name}</Text>
                      {m.id === radialCenter ? <Icon name="check" size={14} color={c.accent} /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Depth</Text>
                <Slider value={depth} min={1} max={5} step={1} width={150} onChange={setDepth} />
                <Text style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 13 }}>{depth}</Text>
                <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 11 }}>ring{depth === 1 ? '' : 's'}</Text>
              </View>
            </View>
          </GlassSurface>
        ) : null}

        {/* live preview = the exact SVG that PNG/SVG capture */}
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
                  <Text style={{ color: c.ink, fontFamily: font.sansBold, marginTop: 6, fontSize: 12.5, textAlign: 'center' }}>{e.label}</Text>
                  {e.view ? <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 8.5, marginTop: 2, textTransform: 'capitalize' }}>{view} · {exTheme}</Text> : null}
                </Pressable>
              ))}
            </View>
            <Text style={{ color: c.mute, fontSize: 11.5, marginTop: 10 }}>SVG · PNG use the selected view + theme above. The PDF booklet includes all four views plus a generation-by-generation directory with photos. JSON · CSV · Excel · GEDCOM export the full dataset (GEDCOM opens in Gramps, Ancestry, MyHeritage…).</Text>
          </View>
        </GlassSurface>

        {canImport ? (
          <GlassSurface>
            <View style={{ padding: space(4) }}>
              <Text style={[styles.h, { color: c.mute }]}>IMPORT</Text>
              <Text style={{ color: c.mute, fontSize: 13, marginBottom: 12 }}>Pick a JSON, CSV, Excel or GEDCOM (.ged) file. New members merge in; duplicates (same name + birth date) are skipped. See the import format guide for relationship columns.</Text>
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
  cell: { width: '31%', aspectRatio: 1, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  importBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
});
