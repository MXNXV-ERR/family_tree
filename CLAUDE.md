# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What's here

The repository is the **family-tree app: an Expo (managed) React Native product in `/mobile`** (Android · iOS · web via react-native-web). The original Next.js web app that used to live at the repo root has been removed; `/mobile` is the only app now.

**Read `mobile/CLAUDE.md` before working in `/mobile`** — it has the full architecture (screens, viz, multi-family, desktop workspace, theme/settings).

Root now holds only the app folder plus shared Firebase deploy config:

```
mobile/            ← the app (see mobile/CLAUDE.md)
firebase.json      ← deploy config (firestore + storage rules)
firestore.rules    ← Firestore security rules (deploy with: firebase deploy --only firestore:rules)
storage.rules      ← Storage security rules
figma files/family-tree-reimagined/  ← the Claude Design handoff bundle the UI is built from
```

Firebase project: `family-tree-6a597`. Seeded "Mehta Family" (~25 members).

## Firestore structure & conventions

```
trees/{treeId}                        ← FamilyTree metadata (ownerUid, name, mono, color, inviteCode, …)
trees/{treeId}/members/{id}           ← Member documents
trees/{treeId}/relationships/{id}     ← Relationship documents
trees/{treeId}/memberships/{uid}      ← collaborators + role (multi-family)
users/{uid}/families/{treeId}         ← per-user family index (the switcher)
```

The legacy single tree keeps `treeId === ownerUid`, so old data still loads. Multi-family create/join needs the membership-aware rules in `firestore.rules` deployed — see `mobile/CLAUDE.md` → "Multi-family".

Relationship edges:
- `parent` — directed, `fromId` = CHILD, `toId` = PARENT.
- `spouse` — bidirectional (two docs); optional `status: 'current' | 'divorced'` + `marriageDate`.
- `sibling` — inferred from shared parents in the visuals.

`associatedUserId` on a Member links the node to an app user account (the "You" badge).
