// Family Q&A chat (Phase 6). Sends the serialized tree to Gemini and renders the
// conversation in glass bubbles. Member names in replies become tappable chips
// that open the profile. Used by both the full-screen /chat route (native) and
// the floating glass sheet (web).
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme, radius, space, font, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { TypingDots } from '../ui/primitives';
import { useViewportInset } from '../ui/useViewportInset';
import { Icon } from '../ui/Icon';
import { useAuth } from '../firebase/AuthContext';
import { useRelTerms } from '../theme/RelTermsContext';
import { chat, type ChatTurn } from '../shared/gemini';
import type { Member, Relationship } from '../shared/types';

const SUGGESTIONS = ['Who are the oldest members?', 'How is Jatin related to Diya?', 'List everyone born after 1990', 'Who has the most children?'];

// Conversations survive the panel being closed and reopened for the rest of the
// app session (a page reload starts fresh) — keyed per tree / combined view.
const sessionTurns = new Map<string, ChatTurn[]>();

export function ChatPanel({ members, relationships, onOpenMember, onClose, sessionKey = 'default' }: {
  members: Member[]; relationships: Relationship[];
  onOpenMember: (m: Member) => void; onClose?: () => void; sessionKey?: string;
}) {
  const { c } = useTheme();
  const { user } = useAuth();
  const { lang } = useRelTerms();
  const meName = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.name, [members, user]);
  const [turns, setTurnsState] = useState<ChatTurn[]>(() => sessionTurns.get(sessionKey) ?? []);
  const setTurns = (t: ChatTurn[]) => { sessionTurns.set(sessionKey, t); setTurnsState(t); };
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Mobile-web keyboard: pad the composer up by however much of the viewport
  // the keyboard covers (visualViewport), and keep the newest turn in view.
  const kbInset = useViewportInset();
  useEffect(() => {
    if (kbInset > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [kbInset]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: q }];
    setTurns(next); setInput(''); setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const reply = await chat(next, members, relationships, { meName, language: lang });
      setTurns([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setTurns([...next, { role: 'assistant', content: '⚠ ' + (e instanceof Error ? e.message : 'Something went wrong.') }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Icon name="sparkles" size={19} color={c.accent} />
          <Text style={{ color: c.ink, fontSize: 19, fontFamily: font.serifItalic }}>Family assistant</Text>
        </View>
        {turns.length > 0 ? (
          <Pressable onPress={() => setTurns([])} hitSlop={8}>
            <Text style={{ color: c.mute, fontFamily: font.sansSemi, fontSize: 12.5 }}>Clear</Text>
          </Pressable>
        ) : null}
        {onClose ? <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: c.mute, fontSize: 22 }}>×</Text></Pressable> : null}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
        {turns.length === 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.mute, lineHeight: 20 }}>Ask anything about your family — relationships, dates, who's related to whom.</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => send(s)} style={[styles.sugg, { borderColor: c.line, backgroundColor: c.paper }]}>
                <Text style={{ color: c.inkSoft }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {turns.map((t, i) => (
          <Bubble key={i} turn={t} c={c} members={members} onOpenMember={onOpenMember} />
        ))}
        {busy ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }}>
              <TypingDots />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-end', paddingBottom: 12 + kbInset }}>
        <TextInput
          value={input} onChangeText={setInput} placeholder="Ask about your family…" placeholderTextColor={c.mute}
          multiline onSubmitEditing={() => send(input)}
          style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.paper }]}
        />
        <Pressable onPress={() => send(input)} disabled={busy || !input.trim()} style={[styles.sendBtn, { backgroundColor: c.accent, opacity: busy || !input.trim() ? 0.4 : 1 }]}>
          <Icon name="send" size={18} color={c.accentInk} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ turn, c, members, onOpenMember }: { turn: ChatTurn; c: Palette; members: Member[]; onOpenMember: (m: Member) => void }) {
  const isUser = turn.role === 'user';
  return (
    <View style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
      <GlassSurface rounded={radius.lg} style={{ borderColor: isUser ? c.accent : c.line }}>
        <View style={{ padding: space(3), backgroundColor: isUser ? c.accentSoft : 'transparent' }}>
          <Text style={{ color: c.ink, lineHeight: 21 }}>
            {renderWithChips(turn.content, members, c, onOpenMember)}
          </Text>
        </View>
      </GlassSurface>
    </View>
  );
}

// Split assistant text on member names → tappable chips (longest names first so
// "Diya Mehta" wins over "Diya"). Case-insensitive, whole-word-ish.
function renderWithChips(text: string, members: Member[], c: Palette, onOpen: (m: Member) => void): React.ReactNode[] {
  const names = members
    .map((m) => ({ m, n: m.name }))
    .filter((x) => x.n && x.n.length > 1)
    .sort((a, b) => b.n.length - a.n.length);
  if (!names.length) return [text];

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${names.map((x) => esc(x.n)).join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) => {
    const hit = names.find((x) => x.n.toLowerCase() === part.toLowerCase());
    if (hit) {
      return (
        <Text key={i} onPress={() => onOpen(hit.m)} style={{ color: c.accent, fontWeight: '700' }}>{part}</Text>
      );
    }
    return part;
  });
}

const styles = StyleSheet.create({
  sugg: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  input: { flex: 1, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
