// The sky — the one component every birthday screen reuses (SPEC §2, §3, §4).
//
// Geometry never switches with family size: the celebrant's node is the hub and
// every wish gets one straight link out to its own token, scattered on stable
// seeded positions (unequal radii and angles, never a ring). Two people and
// twenty-five produce the same shape.
//
// The component also owns the whole celebration choreography — reveal → opener →
// handover → links — because the tokens must be the SAME mounted views across
// all four beats. That is what makes the handover read as one object instead of
// a cut: nothing unmounts, the tokens simply ease from their opener positions to
// their seeded ones while the hub identity swaps underneath them.
//
// Animation note (from the spec, and it bites): the drift-in entrance sits on a
// WRAPPER and the permanent wander on the token INSIDE it — both animate
// transform, so one element cannot carry both.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, Platform } from 'react-native';
import Svg, { Line, Circle, Path, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { useTheme, font } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { Avatar } from '../ui/primitives';
import { initials } from '../shared/adjacency';
import {
  seededPositions, capWishes, isRead, mediaKind, tsMs, type SkyFrame,
} from '../shared/birthday';
import * as haptics from './haptics';
import { DawnRidges } from './DawnRidges';
import type { Member, Note } from '../shared/types';

// RN-Animated injects `collapsable: false` into animated props, and on web
// react-native-svg forwards unknown props straight to the DOM element (React's
// non-boolean-attribute warning). Strip it before it reaches the SVG shape —
// the same shim viz/RadialView.tsx uses.
const sansCollapsable = <P extends object>(C: React.ComponentType<P>) =>
  ({ collapsable: _c, ...p }: P & { collapsable?: boolean }) => <C {...(p as P)} />;
const AnimatedLine = Animated.createAnimatedComponent(sansCollapsable(Line));
const AnimatedCircle = Animated.createAnimatedComponent(sansCollapsable(Circle));
const ANIMATED_G = Animated.createAnimatedComponent(sansCollapsable(G));

export type SkyMode = 'wall' | 'celebration' | 'sealed';

// Beats of the celebration, in order. `rest` is the sky at rest (the wall).
export type Beat = 'crown' | 'opener' | 'handover' | 'links' | 'rest';

const EASE = Easing.bezier(0.16, 1, 0.3, 1); // every celebration motion

const HUB = 88;
const DEFAULT_STICKER = '✉️';

export interface SkyHandle { beat: Beat }

interface TokenAnim {
  id: string;
  pos: Animated.ValueXY;   // live centre, animated between opener and seeded spots
  enter: Animated.Value;   // 0 → 1 drift-in / bloom (wrapper)
  wander: Animated.Value;  // 0 → 1 loop (token itself)
  cool: Animated.Value;    // 0 unread → 1 read (link colour + token dimming)
  draw: Animated.Value;    // 1 → 0 stroke-dashoffset fraction
  dx: number; dy: number;  // per-token wander amplitude
  dur: number;             // per-token wander period
  fromX: number; fromY: number; // off-screen drift-in origin
}

export function BirthdaySky({
  celebrant, wishes, senderOf, mode = 'wall', hubLit, sender,
  onOpenWish, onSequenceDone, onBeat, replayKey = 0, style,
}: {
  celebrant?: Member;
  wishes: Note[];
  /** Who a wish is from — resolved per WISH (fromMemberId first), never by uid:
   *  the account owner is the wrong face for a wish written on someone's behalf. */
  senderOf: (w: Note) => Member | undefined;
  mode?: SkyMode;
  /** Force the hub gold (the day / the celebration). Defaults to mode. */
  hubLit?: boolean;
  /** The opener's subject — the single sender, when there is one. */
  sender?: Member;
  onOpenWish?: (w: Note) => void;
  onSequenceDone?: () => void;
  /** Every beat change — the screen's copy fades on the handover with it. */
  onBeat?: (beat: Beat) => void;
  replayKey?: number;
  style?: object;
}) {
  const { c, mode: themeMode } = useTheme();
  const { motion } = useSettings();
  const light = themeMode === 'light';
  const [box, setBox] = useState({ w: 390, h: 720 });
  const [beat, setBeat] = useState<Beat>(mode === 'celebration' ? 'crown' : 'rest');
  const [expanded, setExpanded] = useState(false); // the "+n" node was tapped

  const frame: SkyFrame = useMemo(
    () => ({ w: box.w, h: box.h, hubX: box.w / 2, hubY: box.h * 0.51 }),
    [box.w, box.h],
  );

  const { shown, overflow } = useMemo(() => (expanded ? { shown: wishes, overflow: [] } : capWishes(wishes)), [wishes, expanded]);
  const ids = useMemo(() => shown.map((w) => w.id), [shown]);
  // Reserve the header + celebration copy at the top and the CTA/FAB strip at
  // the bottom, so a token never lands under chrome it can't be tapped through.
  const seeded = useMemo(
    () => seededPositions(ids, frame, {
      // Scale with the frame: the full screen reserves a header + copy band and
      // a CTA strip, but the archive embeds this sky in a ~420px panel where
      // fixed insets would squeeze every token into one thin ribbon.
      top: Math.min(168, box.h * 0.19),
      bottom: box.h - Math.min(150, box.h * 0.17),
    }),
    [ids, frame, box.h],
  );
  const seatOf = useMemo(() => new Map(seeded.map((s) => [s.id, s])), [seeded]);

  // Opener layout: the same seeded angles, pulled in tight around the sender's
  // avatar, so the handover is a short ease rather than a scramble.
  const openerCentre = { x: frame.hubX, y: frame.hubY - 92 };
  const openerSeat = (id: string) => {
    const s = seatOf.get(id);
    if (!s) return openerCentre;
    // Clamp to the same bands the seeded seats respect — the opener sits higher
    // up the frame, so an unclamped seat pushes tokens under the copy or off the
    // right edge, where they read as debris rather than her wishes.
    const pad = 62;
    return {
      x: Math.max(pad, Math.min(frame.w - pad, openerCentre.x + Math.cos(s.angle) * s.r * 0.62)),
      // The floor clears the celebration copy, not just the header: at 210 a
      // token landed on top of "It's your day" during the opener.
      y: Math.max(Math.min(304, box.h * 0.35), Math.min(box.h - 190, openerCentre.y + Math.sin(s.angle) * s.r * 0.52)),
    };
  };

  // ---- per-token animation records (kept across re-renders by id) ----------
  const anims = useRef(new Map<string, TokenAnim>()).current;
  const startAtOpener = mode === 'celebration';
  shown.forEach((w) => {
    if (anims.has(w.id)) return;
    const s = seatOf.get(w.id);
    const seat = startAtOpener ? openerSeat(w.id) : { x: s?.x ?? frame.hubX, y: s?.y ?? frame.hubY };
    const a = (s?.angle ?? 0);
    anims.set(w.id, {
      id: w.id,
      pos: new Animated.ValueXY(seat),
      enter: new Animated.Value(startAtOpener && motion ? 0 : 1),
      wander: new Animated.Value(0),
      cool: new Animated.Value(isRead(w) ? 1 : 0),
      draw: new Animated.Value(mode === 'celebration' && motion ? 1 : 0),
      dx: 4 + ((w.id.charCodeAt(0) + 3) % 3),
      dy: 4 + ((w.id.charCodeAt(w.id.length - 1) + 1) % 3),
      dur: 9000 + ((w.id.charCodeAt(1) ?? 7) % 7) * 1000,
      fromX: Math.cos(a) * frame.w * 0.9,
      fromY: Math.sin(a) * frame.h * 0.55,
    });
  });

  // Seeded seats change when the frame is measured or a wish is added — glide,
  // never jump (but only once we're past the handover).
  useEffect(() => {
    if (beat !== 'rest' && beat !== 'links') return;
    seeded.forEach((s) => {
      const t = anims.get(s.id);
      if (!t) return;
      if (!motion) { t.pos.setValue({ x: s.x, y: s.y }); return; }
      Animated.timing(t.pos, { toValue: { x: s.x, y: s.y }, duration: 420, easing: EASE, useNativeDriver: false }).start();
    });
  }, [seeded, beat, motion]);

  // Reading a wish cools its link and dims its token — in place, animated.
  useEffect(() => {
    shown.forEach((w) => {
      const t = anims.get(w.id);
      if (!t) return;
      const target = isRead(w) ? 1 : 0;
      if (!motion) { t.cool.setValue(target); return; }
      Animated.timing(t.cool, { toValue: target, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });
  }, [shown, motion]);

  // Permanent 4–6px wander, 9–15s, staggered. The hub never wanders in light
  // mode (it is pinned inside the sun glow, SPEC §8).
  useEffect(() => {
    if (!motion) return;
    const loops = shown.map((w, i) => {
      const t = anims.get(w.id)!;
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(i * 240),
        Animated.timing(t.wander, { toValue: 1, duration: t.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(t.wander, { toValue: 0, duration: t.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [shown.length, motion]);

  // Report every beat change up: the screen's celebration copy has to fade on
  // the handover, or the tokens fly through it on their way to their seats.
  useEffect(() => { onBeat?.(beat); }, [beat]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ---- crown + opener values ----------------------------------------------
  const crown = useRef(new Animated.Value(0)).current;
  const openerIn = useRef(new Animated.Value(mode === 'celebration' ? 0 : 1)).current;
  const openerOut = useRef(new Animated.Value(0)).current; // 0 → 1 during handover
  const hubGrow = useRef(new Animated.Value(mode === 'celebration' ? 0 : 1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  // ---- the sequence --------------------------------------------------------
  useEffect(() => {
    if (mode !== 'celebration') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, motion ? ms : 0));

    // reset
    setBeat('crown');
    crown.setValue(0); openerOut.setValue(0);
    openerIn.setValue(motion ? 0 : 1);
    hubGrow.setValue(motion ? 0 : 1);
    shown.forEach((w) => {
      const t = anims.get(w.id)!;
      t.pos.setValue(openerSeat(w.id));
      t.enter.setValue(motion ? 0 : 1);
      t.draw.setValue(motion ? 1 : 0);
    });

    if (!motion) {
      // Reduced motion: no drift, no crown, links already drawn, copy cross-fades.
      seeded.forEach((s) => anims.get(s.id)?.pos.setValue({ x: s.x, y: s.y }));
      setBeat('rest');
      onSequenceDone?.();
      return () => timers.forEach(clearTimeout);
    }

    // 1 · Reveal — the crown blooms up 0.5s, holds, is gone by 2.4s, never returns.
    Animated.sequence([
      Animated.timing(crown, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(crown, { toValue: 0, duration: 1000, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true })).start();
    haptics.thud();

    // 2 · Opener — the sender alone, her wishes drifting in from off-screen.
    at(2400, () => {
      setBeat('opener');
      Animated.timing(openerIn, { toValue: 1, duration: 700, easing: EASE, useNativeDriver: true }).start();
      haptics.tap();
      shown.forEach((w, i) => {
        const t = anims.get(w.id)!;
        Animated.timing(t.enter, {
          toValue: 1,
          duration: 2400,
          delay: 200 + Math.min(i, 11) * 105, // 0.2 → 1.35s
          easing: EASE,
          useNativeDriver: true,
        }).start();
      });
    });

    // 3 · Handover (0.7s) — her avatar shrinks into the hub point while the
    // celebrant's node grows behind it and the tokens ease to their seats.
    const handoverAt = 2400 + 2500;
    at(handoverAt, () => {
      setBeat('handover');
      Animated.timing(openerOut, { toValue: 1, duration: 700, easing: EASE, useNativeDriver: true }).start();
      Animated.timing(hubGrow, { toValue: 1, duration: 400, delay: 200, easing: EASE, useNativeDriver: true }).start();
      shown.forEach((w, i) => {
        const s = seatOf.get(w.id);
        if (!s) return;
        Animated.timing(anims.get(w.id)!.pos, {
          toValue: { x: s.x, y: s.y },
          duration: 620,
          delay: 350 + i * 40, // staggered 40ms, finishes before its link arrives
          easing: EASE,
          useNativeDriver: false,
        }).start();
      });
    });

    // 4 · Links draw — one per wish, 0.5s apart, ~0.45s each, one tick each.
    const linksAt = handoverAt + 550;
    at(linksAt, () => setBeat('links'));
    shown.forEach((w, i) => {
      at(linksAt + i * 500, () => {
        Animated.timing(anims.get(w.id)!.draw, { toValue: 0, duration: 450, easing: EASE, useNativeDriver: false }).start();
        haptics.tick();
      });
    });
    at(linksAt + shown.length * 500 + 500, () => { setBeat('rest'); onSequenceDone?.(); });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, replayKey, motion, shown.length, frame.w, frame.h]);

  // The wall's own entrance (first open of the day → bloom) is driven by the
  // screen, which remounts the sky with `replayKey`; at rest the links are
  // simply drawn.
  useEffect(() => {
    if (mode === 'celebration') return;
    shown.forEach((w) => anims.get(w.id)?.draw.setValue(0));
  }, [mode, shown.length]);

  // ---- palette -------------------------------------------------------------
  // Unread cannot be carried by glow on a pale ground (SPEC §8): in light mode
  // unread is a solid amber ring plus a drop shadow, read is desaturated.
  const P = light
    ? {
        linkUnread: '#c9852a', linkRead: '#6b52c8', linkReadOp: 0.22, linkUnreadOp: 0.95,
        ringUnread: '#e0a23c', ringRead: 'rgba(43,55,87,0.25)',
        ink: '#2b3757', goldInk: '#7a4f08', hubBrd: '#fffdf8', hubFill: '#2b3757',
      }
    : {
        linkUnread: c.gold, linkRead: c.accent, linkReadOp: 0.22, linkUnreadOp: 0.8,
        ringUnread: c.gold, ringRead: 'rgba(167,139,255,0.3)',
        ink: c.inkSoft, goldInk: c.gold, hubBrd: hubLit ?? mode === 'celebration' ? c.gold : c.accent, hubFill: c.paper,
      };

  const lit = hubLit ?? (mode === 'celebration');
  const hubBorder = light ? '#fffdf8' : lit ? c.gold : c.accent;

  // Live (wander-adjusted) coordinates, shared by the token and its link so the
  // link always lands on the token.
  const liveX = (t: TokenAnim) => Animated.add(t.pos.x, t.wander.interpolate({ inputRange: [0, 1], outputRange: [-t.dx, t.dx] }));
  const liveY = (t: TokenAnim) => Animated.add(t.pos.y, t.wander.interpolate({ inputRange: [0, 1], outputRange: [t.dy, -t.dy] }));

  const overflowSeat = overflow.length
    ? { x: frame.hubX + Math.cos(2.2) * frame.w * 0.3, y: frame.hubY + Math.sin(2.2) * frame.h * 0.22 }
    : null;

  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]} onLayout={(e) => {
      const { width, height } = e.nativeEvent.layout;
      if (Math.abs(width - box.w) > 1 || Math.abs(height - box.h) > 1) setBox({ w: width, h: height });
    }}>
      {/* Light mode is a dawn range, not an inverted sky. Dark never gets a ridge. */}
      {light ? <DawnRidges frame={frame} /> : null}

      {/* links + crown live in one SVG under the tokens */}
      <Svg width={box.w} height={box.h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
        <Defs>
          <RadialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={light ? '#ffd696' : c.gold} stopOpacity={light ? 0.92 : 0.34} />
            <Stop offset="0.42" stopColor={light ? '#ffe2b4' : c.gold} stopOpacity={light ? 0.45 : 0.12} />
            <Stop offset="1" stopColor={light ? '#ffe2b4' : c.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* the sun glow / hub halo — the celebrant's node is pinned inside it */}
        {(light || lit) ? (
          <Circle cx={frame.hubX} cy={frame.hubY} r={light ? 230 : 150} fill="url(#hubGlow)" />
        ) : null}

        {/* ray crown — blooms once at the reveal and never returns. RN has no
            conic gradient, so the crown is a fan of rays masked to an annulus. */}
        {mode === 'celebration' ? (
          <AnimatedCrown crown={crown} spin={spin} frame={frame} color={c.gold} />
        ) : null}

        {beat !== 'opener' && beat !== 'crown' && mode !== 'sealed'
          ? shown.map((w) => {
            const t = anims.get(w.id)!;
            const len = 280;
            return (
              <AnimatedLine
                key={w.id}
                x1={frame.hubX}
                y1={frame.hubY}
                x2={liveX(t) as unknown as number}
                y2={liveY(t) as unknown as number}
                strokeWidth={1.2}
                strokeDasharray={`${len},${len}`}
                strokeDashoffset={t.draw.interpolate({ inputRange: [0, 1], outputRange: [0, len] }) as unknown as number}
                stroke={t.cool.interpolate({ inputRange: [0, 1], outputRange: [P.linkUnread, P.linkRead] }) as unknown as string}
                strokeOpacity={t.cool.interpolate({ inputRange: [0, 1], outputRange: [P.linkUnreadOp, P.linkReadOp] }) as unknown as number}
              />
            );
          })
          : null}
      </Svg>

      {/* ---- the hub: the celebrant's node ---- */}
      {mode !== 'sealed' ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          left: frame.hubX - HUB / 2,
          top: frame.hubY - HUB / 2,
          opacity: hubGrow,
          transform: [{ scale: hubGrow }],
        }}>
          <View style={{
            width: HUB, height: HUB, borderRadius: HUB, overflow: 'hidden',
            borderWidth: light ? 2.5 : 2, borderColor: hubBorder,
            backgroundColor: light ? '#2b3757' : c.paper,
            alignItems: 'center', justifyContent: 'center',
            ...(lit && !light ? { shadowColor: c.gold, shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 0 }, elevation: 8 } : null),
          }}>
            {celebrant?.photoUrl
              ? <Image source={{ uri: celebrant.photoUrl }} style={{ width: '100%', height: '100%' }} />
              : <Text style={{ color: light ? '#fffdf8' : lit ? c.gold : c.accent, fontFamily: font.sansBold, fontSize: 28 }}>
                  {celebrant ? initials(celebrant.name) : '?'}
                </Text>}
          </View>
        </Animated.View>
      ) : null}

      {/* ---- the opener: the sender alone, no concentric rings ---- */}
      {mode === 'celebration' && sender && (beat === 'opener' || beat === 'handover') ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          left: openerCentre.x - 54,
          top: openerCentre.y - 54,
          opacity: Animated.multiply(openerIn, openerOut.interpolate({ inputRange: [0, 0.5, 0.86, 1], outputRange: [1, 1, 0.6, 0] })),
          transform: [
            // 108 → 44px while sliding to the hub point
            { translateX: openerOut.interpolate({ inputRange: [0, 1], outputRange: [0, frame.hubX - openerCentre.x] }) },
            { translateY: openerOut.interpolate({ inputRange: [0, 1], outputRange: [0, frame.hubY - openerCentre.y] }) },
            { scale: Animated.multiply(openerIn, openerOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] })) },
          ],
        }}>
          <View style={{
            width: 108, height: 108, borderRadius: 108, overflow: 'hidden',
            borderWidth: 2, borderColor: c.gold, backgroundColor: c.paper,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: c.gold, shadowOpacity: 0.34, shadowRadius: 70, shadowOffset: { width: 0, height: 0 }, elevation: 10,
          }}>
            {sender.photoUrl
              ? <Image source={{ uri: sender.photoUrl }} style={{ width: '100%', height: '100%' }} />
              : <Text style={{ color: c.gold, fontFamily: font.sansBold, fontSize: 34 }}>{initials(sender.name)}</Text>}
          </View>
        </Animated.View>
      ) : null}

      {/* ---- tokens ---- */}
      {mode !== 'sealed' ? shown.map((w, i) => {
        const t = anims.get(w.id)!;
        return (
          <WishTokenView
            key={w.id}
            wish={w}
            anim={t}
            index={i}
            light={light}
            sender={senderOf(w)}
            onPress={onOpenWish ? () => { haptics.press(); onOpenWish(w); } : undefined}
          />
        );
      }) : null}

      {/* ---- the "+n" node: everything past the twelve-link cap ---- */}
      {overflowSeat && overflow.length ? (
        <Pressable
          onPress={() => setExpanded(true)}
          style={{
            position: 'absolute', left: overflowSeat.x - 19, top: overflowSeat.y - 19,
            width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderStyle: 'dashed', borderColor: light ? '#c9852a' : c.gold,
            backgroundColor: light ? 'rgba(255,255,255,0.7)' : 'rgba(30,24,48,0.7)',
          }}>
          <Text style={{ color: light ? P.goldInk : c.gold, fontFamily: font.monoSemi, fontSize: 11 }}>+{overflow.length}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---- one token -------------------------------------------------------------
// Media wish → rounded square showing the thumbnail, the sender's sticker as a
// corner badge. Note wish → circle carrying the sticker. Media always wins the
// node. Unread beats everything for size; read drops to 28–34px at 55%.
function WishTokenView({ wish, anim, index, light, sender, onPress }: {
  wish: Note; anim: TokenAnim; index: number; light: boolean; sender?: Member; onPress?: () => void;
}) {
  const { c } = useTheme();
  const read = isRead(wish);
  const kind = mediaKind(wish);
  const video = kind === 'video';
  const media = kind !== 'none';

  const size = read ? (media ? 34 : 30) : media ? 64 : 52;
  const sticker = wish.wish?.sticker || DEFAULT_STICKER;
  const ring = read
    ? (light ? 'rgba(43,55,87,0.25)' : 'rgba(167,139,255,0.3)')
    : video ? (light ? '#c8456f' : c.rose)
      : (light ? '#e0a23c' : c.gold);

  const label = read
    ? `${video ? 'Video' : media ? 'Photo' : 'Note'} · ${(sender?.name ?? wish.fromName ?? '').split(' ')[0]}`
    : `${video ? 'Video' : media ? 'Photo' : 'Note'} · new`;

  const labelColor = light
    ? (read ? '#2b3757' : video ? '#7a1f3d' : '#7a4f08')
    : (read ? c.mute : video ? c.rose : c.gold);

  return (
    // wrapper: position + drift-in entrance
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 0, top: 0,
        transform: [
          { translateX: Animated.subtract(anim.pos.x, size / 2) },
          { translateY: Animated.subtract(anim.pos.y, size / 2) },
        ],
      }}>
      <Animated.View style={{
        opacity: anim.enter.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.7, 1] }),
        transform: [
          { translateX: anim.enter.interpolate({ inputRange: [0, 1], outputRange: [anim.fromX, 0] }) },
          { translateY: anim.enter.interpolate({ inputRange: [0, 1], outputRange: [anim.fromY, 0] }) },
          { scale: anim.enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
        ],
      }}>
        {/* token: the permanent wander lives here, never on the wrapper */}
        <Animated.View style={{
          transform: [
            { translateX: anim.wander.interpolate({ inputRange: [0, 1], outputRange: [-anim.dx, anim.dx] }) },
            { translateY: anim.wander.interpolate({ inputRange: [0, 1], outputRange: [anim.dy, -anim.dy] }) },
          ],
        }}>
          <Pressable onPress={onPress} hitSlop={10} style={{ alignItems: 'center' }}>
            <Animated.View style={{
              width: size, height: size,
              borderRadius: media ? 14 : size,
              borderWidth: read ? 1 : light ? 2.5 : 2,
              borderColor: ring,
              overflow: 'hidden',
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: light ? 'rgba(255,255,255,0.92)' : c.paper,
              opacity: anim.cool.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
              // light mode: a white halo lifts the token off whatever it crosses,
              // and unread sits forward on a drop shadow instead of a glow
              ...(light
                ? { shadowColor: read ? 'transparent' : 'rgba(43,55,87,0.3)', shadowOpacity: read ? 0 : 1, shadowRadius: 13, shadowOffset: { width: 0, height: 12 }, elevation: read ? 0 : 6 }
                : { shadowColor: read ? 'transparent' : ring, shadowOpacity: read ? 0 : 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: read ? 0 : 6 }),
              ...(light && !read ? { borderColor: video ? '#c8456f' : '#e0a23c' } : null),
            }}>
              {media && wish.image
                ? <Image source={{ uri: wish.image }} style={{ width: '100%', height: '100%' }} />
                : media
                  ? <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: light ? '#e7ecf7' : c.paper2 }}>
                      <Text style={{ fontSize: size * 0.4 }}>{video ? '🎬' : '🖼'}</Text>
                    </View>
                  : <Text style={{ fontSize: size * 0.46 }}>{sticker}</Text>}
            </Animated.View>

            {/* the sender's sticker rides a media token as a corner badge */}
            {media ? (
              <View style={{
                position: 'absolute', right: -4, top: -4,
                width: 22, height: 22, borderRadius: 11,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: light ? '#fffdf8' : c.paper,
                borderWidth: 1, borderColor: light ? 'rgba(43,55,87,0.18)' : c.line,
              }}>
                <Text style={{ fontSize: 11 }}>{sticker}</Text>
              </View>
            ) : null}

            {/* replied → a small violet tick at the upper-right */}
            {wish.repliedAt ? (
              <View style={{ position: 'absolute', left: -6, top: -6 }}>
                <Svg width={11} height={11} viewBox="0 0 24 24">
                  <Path d="M5 12.5l4.5 4.5L19 7" stroke={light ? '#6b52c8' : c.accent} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            ) : null}

            <Text numberOfLines={1} style={{
              marginTop: 5, maxWidth: 96, textAlign: 'center',
              color: labelColor, fontFamily: font.monoSemi,
              fontSize: light ? 9.5 : 9, letterSpacing: 1.1, textTransform: 'uppercase',
              // captions need the same lift as the tokens on a pale ground
              ...(light ? { textShadowColor: 'rgba(255,255,255,0.95)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } } : null),
            }}>{label}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

// ---- the ray crown ---------------------------------------------------------
// A 360px fan of rays masked to a 72–166px annulus, plus a counter-rotating
// inner fan. Blooms up over 0.5s, gone by 2.4s, never returns.
function AnimatedCrown({ crown, spin, frame, color }: {
  crown: Animated.Value; spin: Animated.Value; frame: SkyFrame; color: string;
}) {
  const rays = useMemo(() => {
    const out: { d: string; w: number }[] = [];
    for (let deg = 0; deg < 360; deg += 12) {
      const a = (deg * Math.PI) / 180;
      out.push({
        d: `M${frame.hubX + Math.cos(a) * 72} ${frame.hubY + Math.sin(a) * 72} L${frame.hubX + Math.cos(a) * 166} ${frame.hubY + Math.sin(a) * 166}`,
        w: 1.1,
      });
    }
    return out;
  }, [frame.hubX, frame.hubY]);

  const AnimatedG = ANIMATED_G;
  return (
    <AnimatedG opacity={crown as unknown as number}>
      {rays.map((r, i) => (
        <Path key={i} d={r.d} stroke={color} strokeWidth={r.w} strokeOpacity={0.5} fill="none" />
      ))}
    </AnimatedG>
  );
}
