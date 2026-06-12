// Full-screen chat route (used on native; also reachable on web).
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme } from '../src/theme/theme';
import { ChatPanel } from '../src/components/ChatPanel';
import type { Member } from '../src/shared/types';

export default function ChatRoute() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { members, relationships } = useFamilyTree(user?.uid);
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ChatPanel
        members={members}
        relationships={relationships}
        onOpenMember={(m: Member) => router.push({ pathname: '/profile', params: { id: m.id } })}
        onClose={() => router.back()}
      />
    </View>
  );
}
