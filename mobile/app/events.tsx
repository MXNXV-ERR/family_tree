// Mobile route for the family events panel. Desktop hosts EventsPanel in the
// right drawer (see DesktopWorkspace). Viewing is open; editing is owner/admin.
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme } from '../src/theme/theme';
import { EventsPanel } from '../src/components/EventsPanel';
import { canManageData } from '../src/shared/permissions';

export default function EventsRoute() {
  const { c } = useTheme();
  const router = useRouter();
  const { activeTreeId, activeFamily } = useFamily();
  const { members, events } = useFamilyTree(activeTreeId);
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {activeTreeId ? (
        <EventsPanel treeId={activeTreeId} members={members} events={events} canManage={canManageData(activeFamily?.role)} onClose={() => router.back()} />
      ) : null}
    </View>
  );
}
