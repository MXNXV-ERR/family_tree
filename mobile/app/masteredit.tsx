// Mobile route for the master edit grid. Desktop hosts MasterEditGrid as a
// full-width canvas view (see DesktopWorkspace). Owner/admin only.
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme } from '../src/theme/theme';
import { MasterEditGrid } from '../src/components/MasterEditGrid';
import { canManageData } from '../src/shared/permissions';

export default function MasterEditRoute() {
  const { c } = useTheme();
  const router = useRouter();
  const { activeTreeId, activeFamily } = useFamily();
  const { members } = useFamilyTree(activeTreeId);
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {activeTreeId ? (
        <MasterEditGrid treeId={activeTreeId} members={members} canManage={canManageData(activeFamily?.role)} onClose={() => router.back()} />
      ) : null}
    </View>
  );
}
