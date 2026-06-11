'use client';

// Family Explorer — the app's primary tree visualizer.
// Renders ONE unified panel: a single header (back + title, view tabs,
// search, custom actions, export, theme toggle) above the active view.
//
// Usage from dashboard/page.tsx:
//   <FamilyExplorer
//     members={members}
//     relationships={relationships}
//     loading={treeLoading}
//     treeId={viewTreeId}
//     focusNodeId={focusNodeId}
//     userId={user.uid}
//     title={treeMetadata?.name}
//     subtitle={user.email}
//     onBack={handleResetView}
//     actions={<>…header buttons…</>}
//   />

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /** Title shown in the unified header (e.g. the tree name). */
  title?: string;
  /** Small line under the title (e.g. the signed-in email). */
  subtitle?: string;
  /** Renders a back button at the far left of the header. */
  onBack?: () => void;
  /** Extra action buttons rendered on the right side of the header. */
  actions?: ReactNode;
}

export function FamilyExplorer({
  members, relationships, loading, focusNodeId, userId, title, subtitle, onBack, actions,
}: FamilyExplorerProps) {
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

  // If the focused member was deleted, fall back gracefully
  useEffect(() => {
    if (focusId && members.length > 0 && !adjacency.get(focusId)) setFocusId(null);
  }, [focusId, members.length, adjacency]);

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

  const sharedProps = members.length > 0 ? {
    members,
    relationships,
    adjacency,
    focusId: focusId && adjacency.get(focusId) ? focusId : members[0].id,
    meId,
    setFocusId: (id: string) => setFocusId(id),
    onOpenProfile: (m: Member) => setProfileMember(m),
  } : null;

  return (
    <FamilyExplorerThemeProvider>
      <div className="family-explorer">
        {/* Single unified header: title · tabs · search/actions */}
        <header className="fe-topbar">
          <div className="fe-topbar-left">
            {onBack && (
              <button className="fe-icon-btn" onClick={onBack} aria-label="Back" title="Back to tree selection">
                <Icons.ArrowLeft size={17} />
              </button>
            )}
            {(title || subtitle) && (
              <div className="fe-topbar-titles">
                {title && <div className="fe-topbar-title">{title}</div>}
                {subtitle && <div className="fe-topbar-subtitle">{subtitle}</div>}
              </div>
            )}
          </div>

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

          <div className="fe-topbar-actions">
            <SearchBox members={members} onSelect={jumpToMember} />
            {actions}
            <button className="fe-icon-btn" onClick={onExport} aria-label="Export view" title="Export current view as SVG">
              <Icons.Share size={16} />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="fe-view-host" ref={viewRef}>
          {loading ? (
            <div className="fe-placeholder">
              <div className="fe-placeholder-sub">Loading family…</div>
            </div>
          ) : !sharedProps ? (
            <div className="fe-placeholder">
              <p className="fe-placeholder-title">No family members yet</p>
              <p className="fe-placeholder-sub">Use “Add” in the toolbar above to create your first family member.</p>
            </div>
          ) : (
            <>
              {view === 'radial' && <RadialView {...sharedProps} />}
              {view === 'timeline' && <TimelineView {...sharedProps} />}
              {view === 'tree' && <TreeView {...sharedProps} />}
            </>
          )}
        </div>

        <ProfileModal
          member={profileMember}
          adjacency={adjacency}
          meId={meId}
          onClose={() => setProfileMember(null)}
          onJumpTo={jumpToMember}
        />
      </div>
    </FamilyExplorerThemeProvider>
  );
}
