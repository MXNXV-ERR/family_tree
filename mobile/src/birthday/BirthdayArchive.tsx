// Birthdays archive (SPEC §6). When the window closes the sky freezes into the
// member's profile and stays FULLY LIVE forever — tap any token, read the wish,
// react and reply. One entry per year.
//
// This screen wasn't in the design bundle, so it is built from the wall's own
// language: the same sky, the same tokens, the same paper — only the chrome is
// quieter, because a past birthday is a place rather than an event.
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Icon } from '../ui/Icon';
import { BirthdaySky } from './BirthdaySky';
import { WishPaper } from './WishPaper';
import { buildSenders, senderMember } from './model';
import { birthdayCopy, num } from '../shared/birthdayCopy';
import { isWish, unreadCount } from '../shared/birthday';
import type { Member, Note, Relationship } from '../shared/types';

export function BirthdayArchive({
  member, notes, members, relationships, treeId, uid, myMemberId, myName,
}: {
  member: Member;
  /** Every note the viewer can see — the same list the wall reads. */
  notes: Note[];
  members: Member[];
  relationships: Relationship[];
  treeId?: string | null;
  uid?: string | null;
  myMemberId?: string | null;
  myName: string;
}) {
  const { c } = useTheme();
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [openWish, setOpenWish] = useState<Note | null>(null);

  // one entry per year, newest first
  const years = useMemo(() => {
    const byYear = new Map<number, Note[]>();
    notes.forEach((n) => {
      if (!isWish(n) || n.toMemberId !== member.id) return;
      const y = n.wish!.year;
      byYear.set(y, [...(byYear.get(y) ?? []), n]);
    });
    return [...byYear.entries()]
      .map(([year, wishes]) => ({ year, wishes }))
      .sort((a, b) => b.year - a.year);
  }, [notes, member.id]);

  if (!years.length) {
    return (
      <GlassSurface rounded={radius.lg}>
        <View style={{ alignItems: 'center', padding: 34, gap: 10 }}>
          <Icon name="cake" size={28} color={c.faint} />
          <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 13.5, textAlign: 'center', lineHeight: 20 }}>
            {member.name.split(' ')[0]}’s birthday sky appears here once the family starts writing.
          </Text>
        </View>
      </GlassSurface>
    );
  }

  const open = years.find((y) => y.year === openYear);

  return (
    <View style={{ gap: 10 }}>
      {years.map(({ year, wishes }) => {
        const on = openYear === year;
        const senders = buildSenders(wishes, members, relationships, member.id);
        const copy = birthdayCopy({
          senders, wishCount: wishes.length, unread: unreadCount(wishes),
          viewerIsCelebrant: myMemberId === member.id,
        });
        const age = member.birthDate ? year - Number(member.birthDate.slice(0, 4)) : undefined;
        return (
          <GlassSurface key={year} rounded={radius.lg}>
            <Pressable onPress={() => setOpenYear(on ? null : year)} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,206,107,0.14)', borderWidth: 1, borderColor: 'rgba(255,206,107,0.4)' }}>
                <Icon name="cake" size={20} color={c.gold} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 18 }}>
                  {year}{age !== undefined && age > 0 ? ` · turned ${age}` : ''}
                </Text>
                <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 11, marginTop: 2 }}>
                  {copy.countLine}{senders.length ? ` · ${num(senders.length)} ${senders.length === 1 ? 'writer' : 'writers'}` : ''}
                </Text>
              </View>
              <Icon name={on ? 'chevD' : 'chevR'} size={18} color={c.faint} />
            </Pressable>

            {on ? (
              // 470, not 420: the sky's hub keep-out and its token separation
              // both scale with the frame, and 420 left tokens crowding the
              // celebrant once a year held a full set of wishes. Taller than
              // this and the hub drops below the fold of the profile scroll.
              <View style={{ height: 470, borderTopWidth: 1, borderTopColor: c.line }}>
                <BirthdaySky
                  celebrant={member}
                  wishes={wishes}
                  senderOf={(w) => senderMember(w, members)}
                  mode="wall"
                  hubLit={false}
                  onOpenWish={(w) => setOpenWish(w)}
                />
              </View>
            ) : null}
          </GlassSurface>
        );
      })}

      {openWish && open ? (
        <WishPaper
          wishes={open.wishes}
          openId={openWish.id}
          onClose={() => setOpenWish(null)}
          members={members}
          relationships={relationships}
          celebrantId={member.id}
          treeId={treeId}
          uid={uid}
          myMemberId={myMemberId}
          myName={myName}
        />
      ) : null}
    </View>
  );
}
