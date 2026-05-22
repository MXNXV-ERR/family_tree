'use client';

// Family Explorer — drop-in replacement for FamilyTreeGraph.
// Wraps the 3 views (Radial / Timeline / Tree) in a tabbed shell, with
// search, profile modal, dark-mode toggle, and SVG export.
//
// Usage from dashboard/page.tsx:
//   <FamilyExplorer
//     members={members}
//     relationships={relationships}
//     loading={treeLoading}
//     treeId={viewTreeId}
//     focusNodeId={focusNodeId}
//     userId={user.uid}
//   />

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Member, Relationship } from '@/types/tree';
import { buildAdjacency } from '@/lib/familyExplorer/adjacency';
import {
  FamilyExplorerThemeProvider,
  Icons,
  ProfileModal,
  SearchBox,
  ThemeToggle,
} from './common';
import { RadialView } from './RadialView';
import { TimelineView } from './TimelineView';
import { TreeView } from './TreeView';

type ViewMode = 'radial' | 'timeline' | 'tree';

export interface FamilyExplorerProps {
  members: Member[];
  relationships: Relationship[];
  loading?: boolean;
  treeId: string;
  /** Optional initial focus override (e.g. from face search). */
  focusNodeId?: string | null;
  /** Current logged-in user id; the member whose associatedUserId === userId is marked "You". */
  userId?: string;
}

export function FamilyExplorer({ members, relationships, loading, focusNodeId, userId }: FamilyExplorerProps) {
  const adjacency = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);

  // "Me" = the member whose associatedUserId matches the logged-in user
  const meId = useMemo(
    () => members.find((m) => m.associatedUserId && userId && m.associatedUserId === userId)?.id,
    [members, userId],
  );

  const [view, setView] = useState<ViewMode>('radial');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [profileMember, setProfileMember] = useState<Member | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // Initialise focus when data arrives
  useEffect(() => {
    if (focusId) return;
    if (focusNodeId && adjacency.get(focusNodeId)) setFocusId(focusNodeId);
    else if (meId) setFocusId(meId);
    else if (members[0]) setFocusId(members[0].id);
  }, [members, meId, focusNodeId, focusId, adjacency]);

  // External focus override (e.g. user clicked a face search result)
  useEffect(() => {
    if (focusNodeId && adjacency.get(focusNodeId)) setFocusId(focusNodeId);
  }, [focusNodeId, adjacency]);

  const jumpToMember = useCallback((m: Member) => {
    setFocusId(m.id);
    setProfileMember(null);
  }, []);

  const onExport = useCallback(() => {
    const node = viewRef.current?.querySelector('.fe-view') as HTMLElement | null;
    if (!node) return;
    try {
      const rect = node.getBoundingClientRect();
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.fe-toolbar, .fe-icon-btn').forEach((n) => n.remove());
      const xml = new XMLSerializer().serializeToString(clone);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tree-${view}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Export failed', err);
    }
  }, [view]);

  if (loading) {
    return (
      <div className="family-explorer" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ color: 'var(--fe-mute)', fontSize: 13, fontFamily: 'var(--fe-mono)' }}>Loading family…</div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="family-explorer" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', color: 'var(--fe-mute)' }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>No family members yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Add your first family member to get started.</p>
        </div>
      </div>
    );
  }

  const sharedProps = {
    members,
    relationships,
    adjacency,
    focusId: focusId ?? members[0].id,
    meId,
    setFocusId: (id: string) => setFocusId(id),
    onOpenProfile: (m: Member) => setProfileMember(m),
  };

  return (
    <FamilyExplorerThemeProvider>
      <div className="family-explorer">
        <header className="fe-header fe-header-compact">
          <div className="fe-header-actions">
            <SearchBox members={members} onSelect={jumpToMember} />
            <button className="fe-icon-btn" onClick={onExport} aria-label="Export view" title="Export current view as SVG">
              <Icons.Share size={16} />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="fe-tabs-wrap">
          <div className="fe-tabs" role="tablist">
            {([
              ['radial', 'Radial', Icons.Radial],
              ['timeline', 'Timeline', Icons.Timeline],
              ['tree', 'Tree', Icons.Tree],
            ] as Array<[ViewMode, string, (p: { size?: number }) => React.JSX.Element]>).map(([k, label, IconC]) => (
              <button
                key={k}
                role="tab"
                aria-selected={view === k}
                className="fe-tab"
                onClick={() => setView(k)}
              >
                <IconC size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="fe-view-host" ref={viewRef}>
          {view === 'radial' && <RadialView {...sharedProps} />}
          {view === 'timeline' && <TimelineView {...sharedProps} />}
          {view === 'tree' && <TreeView {...sharedProps} />}
        </div>

        <ProfileModal
          member={profileMember}
          adjacency={adjacency}
          onClose={() => setProfileMember(null)}
          onJumpTo={jumpToMember}
        />
      </div>
    </FamilyExplorerThemeProvider>
  );
}
