// Resolves the active regional-language relationship dictionary for the current
// user (a per-user preference set in Settings → Relationship names). Exposed via
// useRelTerms() and consumed at every label render site + the chat.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useUserProfile } from '../firebase/UserProfileContext';
import { resolveRelTerms, type RelTerms } from '../shared/relTerms';

interface RelTermsCtx { lang: string; terms?: RelTerms; }
const Ctx = createContext<RelTermsCtx>({ lang: 'English' });

export function RelTermsProvider({ children }: { children: ReactNode }) {
  const profile = useUserProfile();
  const value = useMemo(
    () => resolveRelTerms(profile ? { lang: profile.relLang, terms: profile.relTerms } : null, null),
    [profile?.relLang, profile?.relTerms],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRelTerms = () => useContext(Ctx);
