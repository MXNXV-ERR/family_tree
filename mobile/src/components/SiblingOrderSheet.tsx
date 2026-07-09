// Age-order editor sheet: thin shell around the shared AgeOrderList. The Save
// button is a PINNED footer below the scroll area — never inside it — so it
// stays reachable however long the family list gets (the desktop drawer used
// to clip it off the bottom).
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { SheetHead, PanelScroll } from './panelChrome';
import { AgeOrderGroups, useAgeOrder } from './AgeOrderList';
import { bulkUpdateMembers } from '../firebase/firestore';
import type { Member, Relationship } from '../shared/types';

export function SiblingOrderSheet({ members, relationships, treeId, highlightId, onClose }: {
  members: Member[]; relationships: Relationship[]; treeId: string;
  highlightId?: string; onClose: () => void;
}) {
  const { c } = useTheme();
  const order = useAgeOrder(members, relationships);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await bulkUpdateMembers(treeId, order.buildChanges());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <SheetHead icon="filter" title="Age order" sub="Who is older, within each generation" onClose={onClose} />
      <PanelScroll contentStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 14 }}>
        <AgeOrderGroups order={order} highlightId={highlightId} />
      </PanelScroll>
      <View style={{ padding: 16, paddingTop: 10, borderTopWidth: 1, borderColor: c.lineSoft }}>
        <Pressable onPress={save} disabled={busy || !order.dirty} style={{
          height: 50, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
          opacity: busy || !order.dirty ? 0.5 : 1,
        }}>
          {busy ? <ActivityIndicator color={c.accentInk} /> : (
            <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Save order</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
