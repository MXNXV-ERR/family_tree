// Full-screen chat route (used on native; also reachable on web).
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme } from '../src/theme/theme';
import { ChatPanel } from '../src/components/ChatPanel';
import type { Member } from '../src/shared/types';

export default function ChatRoute() {
  const { c } = useTheme();
  const { activeTreeId } = useFamily();
  const { members, relationships } = useFamilyTree(activeTreeId);
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ChatPanel
        members={members}
        relationships={relationships}
        sessionKey={activeTreeId ?? 'default'}
        onOpenMember={(m: Member) => router.push({ pathname: '/profile', params: { id: m.id } })}
        onClose={() => router.back()}
      />
    </View>
  );
}
