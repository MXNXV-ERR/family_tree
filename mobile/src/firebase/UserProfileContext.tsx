// Provides the signed-in user's profile doc (users/{uid}) app-wide and seeds it
// from the account on first login. Null when signed out or still loading.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { subscribeUserProfile, ensureUserProfile } from './userProfile';
import type { UserProfile } from '../shared/types';

const Ctx = createContext<UserProfile | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    ensureUserProfile(user).catch((e) => console.warn('ensureUserProfile', e?.message ?? e));
    return subscribeUserProfile(user.uid, setProfile);
  }, [user?.uid]);

  return <Ctx.Provider value={profile}>{children}</Ctx.Provider>;
}

export const useUserProfile = () => useContext(Ctx);
