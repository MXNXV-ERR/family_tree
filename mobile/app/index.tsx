import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/firebase/AuthContext';
import { useTheme } from '../src/theme/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const { c } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  return <Redirect href={user ? '/home' : '/login'} />;
}
