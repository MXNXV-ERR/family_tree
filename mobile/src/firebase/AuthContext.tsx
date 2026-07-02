// Auth context. Email/password fully wired (sign-in + sign-up); Google via
// expo-auth-session (login.tsx drives the OAuth request → signInWithGoogleIdToken);
// Apple via expo-apple-authentication (iOS native → signInWithApple).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as fbSignOut, GoogleAuthProvider, OAuthProvider, signInWithCredential,
  type User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { auth } from './config';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true,
  signIn: async () => {}, signUp: async () => {},
  signInWithGoogleIdToken: async () => {}, signInWithApple: async () => {},
  signOut: async () => {},
});

// A URL-safe random string for the Apple → Firebase nonce handshake.
function randomNonce(len = 32): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  const bytes = Crypto.getRandomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

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
  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  };
  const signInWithGoogleIdToken = async (idToken: string) => {
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  };
  // Apple Sign In (iOS). Firebase needs the raw nonce + Apple's identity token:
  // we hand Apple the SHA-256 of the nonce and Firebase the raw nonce.
  const signInWithApple = async () => {
    const rawNonce = randomNonce();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!cred.identityToken) throw new Error('Apple sign-in did not return an identity token.');
    const credential = new OAuthProvider('apple.com').credential({
      idToken: cred.identityToken,
      rawNonce,
    });
    await signInWithCredential(auth, credential);
  };
  const signOut = async () => {
    await fbSignOut(auth);
  };

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signInWithGoogleIdToken, signInWithApple, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
