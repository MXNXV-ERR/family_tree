// Mobile route for the family group-photo → face-assign flow. Desktop hosts the
// same component in the right drawer (see DesktopWorkspace).
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme } from '../src/theme/theme';
import { FamilyPhotoFlow } from '../src/components/FamilyPhotoFlow';

export default function FamilyPhotoRoute() {
  const { c } = useTheme();
  const router = useRouter();
  const { activeTreeId } = useFamily();
  const { members } = useFamilyTree(activeTreeId);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {activeTreeId ? (
        <FamilyPhotoFlow treeId={activeTreeId} members={members} onClose={() => router.back()} />
      ) : null}
    </View>
  );
}
