// Compose route — resolves the recipient member from ?to=<memberId> and renders
// the shared NoteComposePanel over the ambient sky. The same panel is reused in
// the desktop right-drawer.
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { splitId } from '../src/firebase/masters';
import { myMemberId } from '../src/shared/permissions';
import { safeBack } from '../src/shared/nav';
import { NoteComposePanel } from '../src/components/NoteComposePanel';

export default function NoteCompose() {
  const { user } = useAuth();
  const { activeTreeId } = useFamily();
  const router = useRouter();
  const { to } = useLocalSearchParams<{ to?: string }>();
  // A master (combined) view passes a namespaced `treeId:localId`.
  const split = to ? splitId(to) : null;
  const treeId = split ? split.treeId : activeTreeId;
  const localId = split ? split.localId : to;
  const { members } = useFamilyTree(treeId);
  const recipient = localId ? members.find((m) => m.id === localId) : undefined;
  const myId = myMemberId(members, user?.uid);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <NoteComposePanel treeId={treeId} recipient={recipient} myId={myId} onClose={() => safeBack(router)} />
    </View>
  );
}
