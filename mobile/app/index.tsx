import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/firebase/AuthContext';
import { kvGet } from '../src/firebase/kvStore';
import { PENDING_JOIN_CODE_KEY } from '../src/shared/invite';
import { useTheme } from '../src/theme/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const { c } = useTheme();
  // A signed-out user who tapped an invite link stashed its code before being
  // sent to sign in — finish that join before landing on home.
  const [pendingJoin, setPendingJoin] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    kvGet(PENDING_JOIN_CODE_KEY).then((v) => setPendingJoin(v || null));
  }, [user]);

  if (loading || (user && pendingJoin === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (user && pendingJoin) return <Redirect href={{ pathname: '/join' as never, params: { code: pendingJoin } }} />;
  return <Redirect href={user ? '/home' : '/login'} />;
}
