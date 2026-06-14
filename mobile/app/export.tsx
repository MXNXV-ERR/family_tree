// Export / import route (mobile). Thin shell around the shared <ExportPanel/>,
// which is the same component the desktop workspace drawer renders — so mobile
// and web have identical export/import functionality (only the shell differs).
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme } from '../src/theme/theme';
import { ExportPanel } from '../src/components/ExportPanel';
import { canImport } from '../src/shared/permissions';

export default function ExportScreen() {
  const { c } = useTheme();
  const { activeTreeId, activeFamily } = useFamily();
  const { members, relationships, treeMetadata } = useFamilyTree(activeTreeId);
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ExportPanel
        treeId={activeTreeId}
        members={members}
        relationships={relationships}
        treeName={treeMetadata?.name ?? 'Family Tree'}
        canImport={canImport(activeFamily?.role)}
        onClose={() => router.back()}
      />
    </View>
  );
}
