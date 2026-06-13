// Auth context. Email/password fully wired; Google via expo-auth-session is
// wired through signInWithGoogleIdToken (login.tsx drives the OAuth request).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut,
  GoogleAuthProvider, signInWithCredential,
  type User,
} from 'firebase/auth';
import { auth } from './config';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true, signIn: async () => {}, signInWithGoogleIdToken: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };
  const signInWithGoogleIdToken = async (idToken: string) => {
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  };
  const signOut = async () => {
    await fbSignOut(auth);
  };

  return <Ctx.Provider value={{ user, loading, signIn, signInWithGoogleIdToken, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
