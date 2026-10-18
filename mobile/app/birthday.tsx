// The birthday screen — sealed · celebration · wall, all on the one sky.
//
// Which of the three you get is not a route change: the sky component stays
// mounted and only its phase changes, so the reveal → opener → handover → links
// sequence flows into the resting wall without a cut (SPEC §4).
//
// The wall is a real screen — the bottom nav stays visible — and it is the state
// the celebration settles into, not a separate destination.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useInbox } from '../src/firebase/useInbox';
import { useUserProfile } from '../src/firebase/UserProfileContext';
import { kvGet, kvSet } from '../src/firebase/kvStore';
import { myMemberId } from '../src/shared/permissions';
import { safeBack } from '../src/shared/nav';
import { useTheme, radius, font } from '../src/theme/theme';
import { useSettings } from '../src/theme/SettingsContext';
import { GlassSurface } from '../src/theme/GlassSurface';
import { BottomSheet } from '../src/components/BottomSheet';
import { Icon } from '../src/ui/Icon';
import { Avatar } from '../src/ui/primitives';
import { BirthdaySky, type Beat } from '../src/birthday/BirthdaySky';
import { WishPaper } from '../src/birthday/WishPaper';
import { WishComposer } from '../src/birthday/WishComposer';
import { buildSenders, senderMember } from '../src/birthday/model';
import { birthdayCopy, sealedLine, num } from '../src/shared/birthdayCopy';
import {
  windowFor, wishesFor, myWishesFor, senderCount, unreadCount, isRead, startOfDay,
} from '../src/shared/birthday';
import type { Note } from '../src/shared/types';

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export default function BirthdayScreen() {
  const { c, mode: themeMode } = useTheme();
  const { motion } = useSettings();
  const { user } = useAuth();
  const { activeTreeId } = useFamily();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { members, relationships } = useFamilyTree(activeTreeId);
  const profile = useUserProfile();
  const light = themeMode === 'light';

  const myId = useMemo(() => myMemberId(members, user?.uid), [members, user]);
  const { all } = useInbox(activeTreeId, user?.uid, myId);
  const myName = profile?.name || user?.email?.split('@')[0] || 'Someone';

  const celebrant = useMemo(() => members.find((m) => m.id === id), [members, id]);
  const win = useMemo(() => (celebrant ? windowFor(celebrant) : null), [celebrant]);
  const viewerIsCelebrant = !!myId && myId === celebrant?.id;

  const wishes = useMemo(
    () => (celebrant && win ? wishesFor(all, celebrant.id, win.year) : []),
    [all, celebrant, win],
  );
  const mine = useMemo(
    () => (celebrant && win ? myWishesFor(all, celebrant.id, win.year, user?.uid) : []),
    [all, celebrant, win, user],
  );
  const senders = useMemo(
    () => (celebrant ? buildSenders(wishes, members, relationships, celebrant.id) : []),
    [wishes, members, relationships, celebrant],
  );

  const beforeTheDay = !!win && startOfDay(new Date()) < startOfDay(win.date);
  const sealed = viewerIsCelebrant && beforeTheDay;

  // reveal plays once per day; the wall blooms on the first open of the day and
  // only sweeps on every later one
  const [phase, setPhase] = useState<'loading' | 'sealed' | 'celebration' | 'wall'>('loading');
  // The opener copy belongs to the opener beat. Once the handover starts, the
  // sky is the subject — and the tokens travel right through where the copy sits.
  const [beat, setBeat] = useState<Beat>('crown');
  const [sweep, setSweep] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [openWish, setOpenWish] = useState<Note | null>(null);
  const [composer, setComposer] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!celebrant || !win) return;
      if (sealed) { if (alive) setPhase('sealed'); return; }
      const revealKey = `ft.bday.reveal.${celebrant.id}.${win.year}`;
      const wallKey = `ft.bday.wall.${celebrant.id}`;
      const played = await kvGet(revealKey);
      const lastWall = await kvGet(wallKey);
      if (!alive) return;
      const today = dayKey();
      if (viewerIsCelebrant && played !== today && wishes.length > 0) {
        setPhase('celebration');
        kvSet(revealKey, today);
      } else {
        setPhase('wall');
        setSweep(lastWall === today);   // a return visit only sweeps
      }
      kvSet(wallKey, today);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrant?.id, win?.year, sealed, viewerIsCelebrant, wishes.length > 0]);

  const copy = birthdayCopy({
    senders,
    wishCount: wishes.length,
    viewerIsCelebrant,
    unread: unreadCount(wishes),
    celebrantName: celebrant?.name,
    daysUntil: win?.daysUntil,
  });

  // Resolve the opener's subject the way the wish itself claims it — `fromMemberId`
  // first. Looking the uid up in `associatedUserId` finds whoever owns the account,
  // which is the WRONG face whenever the wish was written on someone's behalf.
  const openerSender = senders.length === 1 && wishes.length
    ? senderMember(wishes[0], members) ?? members.find((m) => m.associatedUserId === senders[0].uid)
    : undefined;

  if (!celebrant || !win) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: c.mute, fontFamily: font.sansMed, textAlign: 'center' }}>
          No birthday is open for this member right now.
        </Text>
        <Pressable onPress={() => safeBack(router)} style={{ marginTop: 14 }}>
          <Text style={{ color: c.accent, fontFamily: font.sansBold }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const firstName = celebrant.name.split(' ')[0];
  const senderName = senders[0]?.name?.split(' ')[0];

  // ---- sealed ------------------------------------------------------------
  if (phase === 'sealed') {
    return (
      <SealedScreen
        daysUntil={win.daysUntil}
        line={sealedLine(senders, true)}
        senders={senders}
        onBack={() => safeBack(router)}
      />
    );
  }

  // Transparent in both modes: the app's ambient sky (stars + aurora) is painted
  // by the root layout and must show through, exactly like every other screen.
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* the sky — the same mounted component in every phase */}
      <BirthdaySky
        key={replayKey}
        celebrant={celebrant}
        wishes={wishes}
        senderOf={(w) => senderMember(w, members)}
        mode={phase === 'celebration' ? 'celebration' : 'wall'}
        hubLit={win.isToday || phase === 'celebration'}
        sender={openerSender}
        replayKey={replayKey}
        onOpenWish={(w) => setOpenWish(w)}
        onSequenceDone={() => setPhase('wall')}
        onBeat={setBeat}
      />

      {/* the light sweep — a return visit, not the first open of the day */}
      {phase === 'wall' && sweep && motion ? <LightSweep /> : null}

      {/* ---- header ---- */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: Platform.OS === 'web' ? 14 : 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 2 }}>
        <Pressable onPress={() => safeBack(router)} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glassBg, borderWidth: 1, borderColor: c.glassBrd }}>
          <Icon name="close" size={18} color={light ? '#2b3757' : c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: light ? '#2b3757' : c.ink, fontFamily: font.serif, fontSize: 21 }}>
            {viewerIsCelebrant
              ? (senderName && senders.length === 1 ? `From ${senderName}` : 'Your sky')
              : `For ${firstName}`}
          </Text>
          <Text numberOfLines={1} style={{ color: light ? '#7a4f08' : c.mute, fontFamily: font.mono, fontSize: 11, letterSpacing: 0.6 }}>
            {wishes.length ? copy.countLine : 'Nothing written yet — be the first'}
          </Text>
        </View>
        {phase === 'wall' && wishes.length ? (
          <Pressable
            onPress={() => { setReplayKey((k) => k + 1); setPhase('celebration'); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, height: 38, borderRadius: radius.pill, backgroundColor: c.glassBg, borderWidth: 1, borderColor: c.glassBrd, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
            <Icon name="sparkles" size={14} color={light ? '#7a4f08' : c.gold} />
            <Text style={{ color: light ? '#2b3757' : c.ink, fontFamily: font.sansSemi, fontSize: 12.5 }}>Replay</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ---- celebration copy + skip ---- */}
      {phase === 'celebration' ? (
        // zIndex, or a token drifting in from off-screen paints OVER the
        // celebration copy on its way to its seat.
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: Platform.OS === 'web' ? 76 : 110, paddingHorizontal: 22, zIndex: 3 }}>
          <CopyRise key={`${replayKey}-copy`} out={beat !== 'crown' && beat !== 'opener'}>
            <Text style={{ color: c.gold, fontFamily: font.monoSemi, fontSize: 10.5, letterSpacing: 3.4, textTransform: 'uppercase' }}>Today</Text>
            <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 40, lineHeight: 44, marginTop: 6 }}>
              {viewerIsCelebrant ? `It’s your day,\n${firstName}` : `${firstName}’s day`}
            </Text>
            <Text style={{ color: c.inkSoft, fontFamily: font.serifMed, fontSize: 22, marginTop: 10 }}>{copy.senderLine ?? copy.headline}</Text>
            {copy.caption ? (
              <Text style={{ color: c.gold, fontFamily: font.monoSemi, fontSize: 10.5, letterSpacing: 2.4, marginTop: 8 }}>{copy.caption}</Text>
            ) : null}
          </CopyRise>

          <Pressable
            onPress={() => setPhase('wall')}
            style={({ pressed }) => ({ position: 'absolute', right: 22, top: -2, paddingHorizontal: 14, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glassBg, borderWidth: 1, borderColor: c.glassBrd, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
            <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>Skip</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ---- CTA / FAB ---- */}
      {phase === 'celebration' ? (
        <Pressable
          onPress={() => setPhase('wall')}
          style={({ pressed }) => ({
            position: 'absolute', left: 22, right: 22, bottom: Platform.OS === 'web' ? 28 : 44,
            height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
            backgroundColor: c.gold, transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: c.gold, shadowOpacity: 0.32, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 8,
          })}>
          <Text style={{ color: c.goldInk, fontFamily: font.sansBold, fontSize: 15.5 }}>{copy.cta}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => { setEditing(null); setComposer(true); }}
          style={({ pressed }) => ({
            position: 'absolute', right: 20, bottom: 98,
            width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }], overflow: 'hidden',
            shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 9,
          })}>
          <LinearGradient colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={25} stroke={2.2} color={c.accentInk} />
          </LinearGradient>
        </Pressable>
      )}

      {/* ---- your own wishes, when you're the giver ---- */}
      {!viewerIsCelebrant && mine.length ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 20 }}>
          <GlassSurface rounded={radius.lg}>
            <View style={{ padding: 12, gap: 8 }}>
              <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {num(mine.length)} {mine.length === 1 ? 'wish' : 'wishes'} from you · sealed until the day
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {mine.map((w) => (
                  <Pressable key={w.id} onPress={() => { setEditing(w); setComposer(true); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, height: 38, borderRadius: radius.pill, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }}>
                    <Text style={{ fontSize: 14 }}>{w.wish?.sticker || (w.image ? '🖼' : '✉️')}</Text>
                    <Text numberOfLines={1} style={{ maxWidth: 130, color: c.inkSoft, fontFamily: font.sansMed, fontSize: 12.5 }}>{w.text || 'A sticker'}</Text>
                    <Icon name="edit" size={13} color={c.accent} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </GlassSurface>
        </View>
      ) : null}

      {/* ---- a wish opens ---- */}
      {openWish ? (
        <WishPaper
          wishes={wishes}
          openId={openWish.id}
          onClose={() => setOpenWish(null)}
          members={members}
          relationships={relationships}
          celebrantId={celebrant.id}
          treeId={activeTreeId}
          uid={user?.uid}
          myMemberId={myId}
          myName={myName}
        />
      ) : null}

      <BottomSheet visible={composer} onClose={() => setComposer(false)} heightRatio={0.92}>
        <WishComposer
          treeId={activeTreeId}
          celebrant={celebrant}
          win={win}
          myWishes={mine}
          uid={user?.uid}
          myMemberId={myId}
          myName={myName}
          editing={editing}
          onClose={() => setComposer(false)}
        />
      </BottomSheet>
    </View>
  );
}

// ---- sealed ----------------------------------------------------------------
// The emptiest screen in the app, on purpose: a countdown, one unlit dashed
// token per sender, and NO links — a single link would say "at least one".
// Never a wish count, never a preview, never "no wishes yet".
function SealedScreen({ daysUntil, line, senders, onBack }: {
  daysUntil: number; line: string; senders: { uid: string; name: string }[]; onBack: () => void;
}) {
  const { c } = useTheme();
  const { motion } = useSettings();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!motion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [motion]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 22 }}>
      <Pressable onPress={onBack} hitSlop={10} style={{ position: 'absolute', left: 16, top: Platform.OS === 'web' ? 14 : 48, width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glassBg, borderWidth: 1, borderColor: c.glassBrd }}>
        <Icon name="close" size={18} color={c.ink} />
      </Pressable>

      <Animated.View style={{
        alignItems: 'center', paddingHorizontal: 34, paddingVertical: 20, borderRadius: 999,
        backgroundColor: 'rgba(255,206,107,0.08)', borderWidth: 1, borderColor: 'rgba(255,206,107,0.38)',
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
      }}>
        <Text style={{ color: c.gold, fontFamily: font.serif, fontSize: 46, lineHeight: 50 }}>{daysUntil}</Text>
        <Text style={{ color: c.gold, fontFamily: font.serifMed, fontSize: 20 }}>{daysUntil === 1 ? 'day to go' : 'days to go'}</Text>
      </Animated.View>

      <Text style={{ color: c.ink, fontFamily: font.serifMed, fontSize: 24, lineHeight: 36, textAlign: 'center' }}>
        {line}{'\n'}You’ll read it on the day.
      </Text>

      {/* someone is there; you can't read them yet */}
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {senders.slice(0, 6).map((s) => {
          // `s.name` is already resolved from the wish's own fromMemberId — never
          // look the uid up here, that finds the account owner instead.
          return (
            <View key={s.uid} style={{
              width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#1a1424', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,127,174,0.4)',
            }}>
              <Text style={{ color: '#5d4f66', fontFamily: font.sansBold, fontSize: 17 }}>
                {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase' }}>
        Sealed · not even how many
      </Text>

      <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
        They can add as many wishes as they like before the day. You’ll see them all at once — and
        anything sent after stays sealed until you open it.
      </Text>
    </View>
  );
}

// ---- the light sweep -------------------------------------------------------
// A 56%-wide near-horizontal gold beam travelling −150% → 250% over 7s. RN has
// no mask, so the vertical falloff is eight stacked bands whose opacity follows
// the mask curve — it reads as a beam, not a rectangle, and clears both edges.
function LightSweep() {
  const { c } = useTheme();
  const [box, setBox] = useState({ w: 390, h: 800 });
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);

  const bands = 8;
  // transparent → #000 18% → #000 82% → transparent
  const maskAt = (p: number) => (p < 0.18 ? p / 0.18 : p > 0.82 ? (1 - p) / 0.18 : 1);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Animated.View style={{
        position: 'absolute', top: 0, height: box.h, width: box.w * 0.56,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-box.w * 1.5, box.w * 2.5] }) },
          { rotate: '10deg' },
        ],
      }}>
        {Array.from({ length: bands }).map((_, i) => (
          <LinearGradient
            key={i}
            colors={['transparent', 'rgba(255,206,107,0.16)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: box.h / bands, opacity: maskAt((i + 0.5) / bands) }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// Copy entrance — rises on motion, cross-fades when motion is off.
function CopyRise({ children, out }: { children: React.ReactNode; out?: boolean }) {
  const { motion } = useSettings();
  const v = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: motion ? 1800 : 500,
      delay: motion ? 300 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [motion]);
  // Hand the frame over to the sky: the copy leaves with the sender, before the
  // tokens cross the band it occupies.
  useEffect(() => {
    Animated.timing(fade, {
      toValue: out ? 0 : 1,
      duration: motion ? 420 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [out, motion]);
  return (
    <Animated.View pointerEvents={out ? 'none' : 'auto'} style={{
      opacity: Animated.multiply(v, fade),
      transform: motion ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] : [],
    }}>
      {children}
    </Animated.View>
  );
}
