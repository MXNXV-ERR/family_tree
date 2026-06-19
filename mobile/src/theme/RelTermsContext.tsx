// Resolves the active regional-language relationship dictionary for the current
// view: a per-user override (from the profile) wins over the active family's
// default. Exposed via useRelTerms() and consumed at every label render site +
// the chat. Subscribes only to the tree doc (not members/relationships) so it's
// cheap.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFamily } from '../firebase/FamilyContext';
import { subscribeFamilyDoc } from '../firebase/families';
import { useUserProfile } from '../firebase/UserProfileContext';
import { resolveRelTerms, type RelTerms } from '../shared/relTerms';
import type { FamilyTree } from '../shared/types';

interface RelTermsCtx { lang: string; terms?: RelTerms; }
const Ctx = createContext<RelTermsCtx>({ lang: 'English' });

export function RelTermsProvider({ children }: { children: ReactNode }) {
  const { activeTreeId } = useFamily();
  const profile = useUserProfile();
  const [family, setFamily] = useState<FamilyTree | null>(null);

  useEffect(() => {
    if (!activeTreeId) { setFamily(null); return; }
    return subscribeFamilyDoc(activeTreeId, setFamily);
  }, [activeTreeId]);

  const value = useMemo(
    () => resolveRelTerms(
      profile ? { lang: profile.relLang, terms: profile.relTerms } : null,
      family,
    ),
    [profile?.relLang, profile?.relTerms, family?.relLang, family?.relTerms],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRelTerms = () => useContext(Ctx);
