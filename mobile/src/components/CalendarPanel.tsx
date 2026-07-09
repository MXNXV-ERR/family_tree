// Family calendar — month grid + occasion list for birthdays, anniversaries and
// family events (the web answer to native-only notification reminders, and a
// handy view on the phone too). Every occasion has an "Add to Google Calendar"
// quick-link, and the whole set exports as a .ics file that Google/Apple/
// Outlook import in one step. Shown in the desktop drawer and a mobile sheet.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useTheme, font, radius, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Icon, type IconName } from '../ui/Icon';
import { SheetHead, PanelScroll } from './panelChrome';
import { buildOccasions, occasionsInMonth, googleCalendarUrl, buildICS, type OccasionKind } from '../shared/occasions';
import { saveText } from '../export/fileExport';
import type { Member, Relationship, FamilyEvent } from '../shared/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const KIND_ICON: Record<OccasionKind, IconName> = { birthday: 'cake', anniversary: 'ring', event: 'calendar' };

const ordSuffix = (n: number) => {
  const t = n % 10, h = n % 100;
  if (t === 1 && h !== 11) return 'st';
  if (t === 2 && h !== 12) return 'nd';
  if (t === 3 && h !== 13) return 'rd';
  return 'th';
};

export function CalendarPanel({ members, relationships, events, treeName, onClose }: {
  members: Member[]; relationships: Relationship[]; events?: FamilyEvent[];
  treeName?: string; onClose: () => void;
}) {
  const { c } = useTheme();
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selDay, setSelDay] = useState<number | null>(null);

  const occasions = useMemo(() => buildOccasions(members, relationships, events ?? []), [members, relationships, events]);
  const monthOccs = useMemo(() => occasionsInMonth(occasions, ym.y, ym.m), [occasions, ym]);

  const kindColor = (k: OccasionKind) => k === 'birthday' ? c.teal : k === 'anniversary' ? c.rose : c.amber;

  // day → occasion kinds present (max 3 dots per cell)
  const dots = useMemo(() => {
    const map = new Map<number, OccasionKind[]>();
    for (const { occ, day } of monthOccs) {
      const arr = map.get(day) ?? [];
      if (!arr.includes(occ.kind)) arr.push(occ.kind);
      map.set(day, arr);
    }
    return map;
  }, [monthOccs]);

  const shift = (delta: number) => {
    setSelDay(null);
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const isThisMonth = ym.y === today.getFullYear() && ym.m === today.getMonth();

  // grid cells: leading blanks + the month's days
  const cells = useMemo(() => {
    const lead = new Date(ym.y, ym.m, 1).getDay();
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const arr: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [ym]);

  const listed = selDay === null ? monthOccs : monthOccs.filter((o) => o.day === selDay);

  const exportICS = () => {
    const name = `${treeName ?? 'Family'} calendar`;
    saveText('family-calendar.ics', buildICS(occasions, name), 'text/calendar');
  };

  const subtitleOf = (occ: (typeof monthOccs)[number]) => {
    const when = `${occ.day} ${MONTHS[ym.m].slice(0, 3)}`;
    if (occ.occ.kind === 'birthday') return occ.years ? `${when} · turns ${occ.years}` : when;
    if (occ.occ.kind === 'anniversary') return occ.years ? `${when} · ${occ.years}${ordSuffix(occ.years)} anniversary` : when;
    return [when, occ.occ.location].filter(Boolean).join(' · ');
  };

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="calendar" title="Family calendar" sub="Birthdays · anniversaries · events" onClose={onClose} />
      <PanelScroll contentStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
        {/* month switcher */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NavBtn c={c} icon="chevL" onPress={() => shift(-1)} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 21 }}>{MONTHS[ym.m]} {ym.y}</Text>
          </View>
          <NavBtn c={c} icon="chevR" onPress={() => shift(1)} />
          {!isThisMonth ? (
            <Pressable onPress={() => { setYm({ y: today.getFullYear(), m: today.getMonth() }); setSelDay(null); }}
              style={{ paddingHorizontal: 10, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft }}>
              <Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 12 }}>Today</Text>
            </Pressable>
          ) : null}
        </View>

        {/* month grid */}
        <GlassSurface rounded={radius.lg}>
          <View style={{ padding: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1 }}>{d}</Text>
              ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
                  if (day === null) return <View key={i} style={{ flex: 1, height: 42 }} />;
                  const isToday = isThisMonth && day === today.getDate();
                  const kinds = dots.get(day);
                  const isSel = selDay === day;
                  return (
                    <Pressable key={i} onPress={() => setSelDay((d) => (d === day ? null : day))}
                      style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: isSel ? c.accentSoft : 'transparent' }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: isToday ? 1.5 : 0, borderColor: c.accent }}>
                        <Text style={{ color: isSel || isToday ? c.accent : kinds ? c.ink : c.inkSoft, fontFamily: kinds ? font.sansBold : font.sans, fontSize: 12.5 }}>{day}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 2.5, height: 4, marginTop: 1 }}>
                        {(kinds ?? []).slice(0, 3).map((k) => (
                          <View key={k} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: kindColor(k) }} />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </GlassSurface>

        {/* legend */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
          {([['birthday', 'Birthdays'], ['anniversary', 'Anniversaries'], ['event', 'Events']] as [OccasionKind, string][]).map(([k, lb]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: kindColor(k) }} />
              <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 11.5 }}>{lb}</Text>
            </View>
          ))}
        </View>

        {/* occasion list (whole month, or the selected day) */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', marginLeft: 2 }}>
            {selDay !== null ? `${selDay} ${MONTHS[ym.m]}` : `This month · ${monthOccs.length}`}
          </Text>
          {listed.length === 0 ? (
            <GlassSurface rounded={radius.lg}>
              <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 13, textAlign: 'center', padding: 20 }}>
                {occasions.length === 0
                  ? 'No occasions yet — add birth dates, marriage dates, or family events to fill the calendar.'
                  : selDay !== null ? 'Nothing on this day.' : 'No occasions this month.'}
              </Text>
            </GlassSurface>
          ) : listed.map((o) => (
            <View key={o.occ.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderRadius: radius.lg, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: kindColor(o.occ.kind) }}>
                <Icon name={KIND_ICON[o.occ.kind]} size={17} color={kindColor(o.occ.kind)} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 13.5 }}>{o.occ.title}</Text>
                <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5, marginTop: 2 }}>{subtitleOf(o)}</Text>
              </View>
              {/* one-tap add to Google Calendar (annual items repeat yearly) */}
              <Pressable onPress={() => Linking.openURL(googleCalendarUrl(o.occ))} hitSlop={6}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 30, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.6 : 1 })}>
                <Icon name="plus" size={13} stroke={2.2} color={c.accent} />
                <Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 11 }}>Google</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* bulk export */}
        <Pressable onPress={exportICS} disabled={occasions.length === 0} style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48,
          borderRadius: radius.md, backgroundColor: c.accent, opacity: occasions.length === 0 ? 0.5 : pressed ? 0.85 : 1,
        })}>
          <Icon name="download" size={18} color={c.accentInk} />
          <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14 }}>Export all as .ics</Text>
        </Pressable>
        <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: -6 }}>
          Import the file in Google Calendar (Settings → Import & export) or open it with Apple/Outlook Calendar. Birthdays and anniversaries repeat yearly.
        </Text>
      </PanelScroll>
    </View>
  );
}

function NavBtn({ c, icon, onPress }: { c: Palette; icon: IconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({
      width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, transform: [{ scale: pressed ? 0.94 : 1 }],
    })}>
      <Icon name={icon} size={16} color={c.inkSoft} />
    </Pressable>
  );
}
