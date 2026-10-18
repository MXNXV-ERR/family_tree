// Desktop: the wall reads in the right drawer (SPEC §9 "Desktop"). There is no
// floating orb here — the toolbar's glowing cake tool opens this panel, and the
// full celebration still takes the whole window via the /birthday route.
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Icon } from '../ui/Icon';
import { SheetHead } from '../components/panelChrome';
import { BirthdaySky } from './BirthdaySky';
import { WishPaper } from './WishPaper';
import { WishComposer } from './WishComposer';
import { buildSenders, senderMember } from './model';
import { birthdayCopy } from '../shared/birthdayCopy';
import { wishesFor, myWishesFor, unreadCount, startOfDay, type BirthdayWindow } from '../shared/birthday';
import type { Member, Note, Relationship } from '../shared/types';

export function DesktopBirthdayPanel({
  win, celebrant, notes, members, relationships, treeId, uid, myMemberId, myName, onPlay, onClose,
}: {
  win: BirthdayWindow;
  celebrant: Member;
  notes: Note[];
  members: Member[];
  relationships: Relationship[];
  treeId?: string | null;
  uid?: string | null;
  myMemberId?: string | null;
  myName: string;
  /** Run the celebration full-window. */
  onPlay: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [openWish, setOpenWish] = useState<Note | null>(null);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  const viewerIsCelebrant = !!myMemberId && myMemberId === celebrant.id;
  const wishes = useMemo(() => wishesFor(notes, celebrant.id, win.year), [notes, celebrant.id, win.year]);
  const mine = useMemo(() => myWishesFor(notes, celebrant.id, win.year, uid), [notes, celebrant.id, win.year, uid]);
  const senders = useMemo(() => buildSenders(wishes, members, relationships, celebrant.id), [wishes, members, relationships, celebrant.id]);
  const sealed = viewerIsCelebrant && startOfDay(new Date()) < startOfDay(win.date);

  const copy = birthdayCopy({
    senders, wishCount: wishes.length, viewerIsCelebrant,
    unread: unreadCount(wishes), daysUntil: win.daysUntil, celebrantName: celebrant.name,
  });

  if (composing) {
    return (
      <WishComposer
        treeId={treeId}
        celebrant={celebrant}
        win={win}
        myWishes={mine}
        uid={uid}
        myMemberId={myMemberId}
        myName={myName}
        editing={editing}
        onClose={() => { setComposing(false); setEditing(null); }}
      />
    );
  }

  const first = celebrant.name.split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <SheetHead
        icon="cake"
        title={viewerIsCelebrant ? (senders.length === 1 ? `From ${senders[0].name.split(' ')[0]}` : 'Your sky') : `For ${first}`}
        sub={sealed ? 'Sealed · not even how many' : wishes.length ? copy.countLine : 'Nothing written yet'}
        onClose={onClose}
      />

      {sealed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
          <View style={{ paddingHorizontal: 30, paddingVertical: 16, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,206,107,0.38)', backgroundColor: 'rgba(255,206,107,0.08)', alignItems: 'center' }}>
            <Text style={{ color: c.gold, fontFamily: font.serif, fontSize: 40 }}>{win.daysUntil}</Text>
            <Text style={{ color: c.gold, fontFamily: font.serifMed, fontSize: 17 }}>{win.daysUntil === 1 ? 'day to go' : 'days to go'}</Text>
          </View>
          <Text style={{ color: c.inkSoft, fontFamily: font.serifMed, fontSize: 18, textAlign: 'center', lineHeight: 27 }}>
            You’ll read it on the day.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            <BirthdaySky
              celebrant={celebrant}
              wishes={wishes}
              senderOf={(w) => senderMember(w, members)}
              mode="wall"
              hubLit={win.isToday}
              onOpenWish={(w) => setOpenWish(w)}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
            {wishes.length ? (
              <Pressable onPress={onPlay} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <Icon name="sparkles" size={16} color={c.gold} />
                <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>Replay</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => { setEditing(null); setComposing(true); }} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.md, backgroundColor: c.accent, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Icon name="plus" size={17} stroke={2.2} color={c.accentInk} />
              <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14 }}>
                {mine.length ? 'Add another' : 'Add your wish'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {openWish ? (
        <WishPaper
          wishes={wishes}
          openId={openWish.id}
          onClose={() => setOpenWish(null)}
          members={members}
          relationships={relationships}
          celebrantId={celebrant.id}
          treeId={treeId}
          uid={uid}
          myMemberId={myMemberId}
          myName={myName}
        />
      ) : null}
    </View>
  );
}

// The toolbar tool: a cake icon wearing the orb's breathing ring.
export function BirthdayToolButton({ onPress, calm }: { onPress: () => void; calm?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Birthday"
      style={({ pressed }) => ({
        width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: calm ? c.line : c.gold,
        backgroundColor: calm ? 'transparent' : 'rgba(255,206,107,0.12)',
        transform: [{ scale: pressed ? 0.95 : 1 }],
        ...(calm ? null : { shadowColor: c.gold, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 6 }),
      })}>
      <Icon name="cake" size={20} color={calm ? c.inkSoft : c.gold} />
    </Pressable>
  );
}
