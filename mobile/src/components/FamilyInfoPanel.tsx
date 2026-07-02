// Family-info panel (the design's FamilyInfoPanel). Shows the active family's
// monogram, summary, stat cards, metadata (region/established/owner/invite) and
// the people who have access. Subscribes to the tree doc + membership docs.
// Shared by the mobile family sheet and the desktop drawer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, Alert, ActivityIndicator, Image, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { joinUrl, inviteMessage } from '../shared/invite';
import { useTheme, font, radius } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Avatar } from '../ui/primitives';
import { Icon, type IconName } from '../ui/Icon';
import { SheetHead } from './panelChrome';
import { useAuth } from '../firebase/AuthContext';
import { subscribeFamilyDoc, subscribeCollaborators, setMemberRole, updateFamily, deleteFamily, ensureInviteCode, FAMILY_COLORS, monoOf, subscribeJoinRequests, approveJoinRequest, rejectJoinRequest } from '../firebase/families';
import { canManageRoles, canManageData, normalizeRole, isOwner } from '../shared/permissions';
import { computeGenerations, countCouples } from '../shared/adjacency';
import type { FamilyTree, Collaborator, Member, Relationship, JoinRequest, JoinPolicy } from '../shared/types';

export function FamilyInfoPanel({ treeId, family, members, relationships, onClose, onSwitchFamily, onUploadPhoto, onOpenEvents, onOpenMasterEdit }: {
  treeId: string;
  family: FamilyTree | null;
  members: Member[];
  relationships: Relationship[];
  onClose: () => void;
  onSwitchFamily?: () => void;
  onUploadPhoto?: () => void;
  onOpenEvents?: () => void;
  onOpenMasterEdit?: () => void;
}) {
  const { c } = useTheme();
  const { user } = useAuth();
  const [doc, setDoc] = useState<FamilyTree | null>(family);
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const canManage = canManageRoles(family?.role);
  const canApprove = canManageData(family?.role);

  useEffect(() => {
    const u1 = subscribeFamilyDoc(treeId, (f) => f && setDoc(f));
    const u2 = subscribeCollaborators(treeId, setCollabs);
    const u3 = subscribeJoinRequests(treeId, setRequests);
    return () => { u1(); u2(); u3(); };
  }, [treeId]);

  const fam = doc ?? family;
  const color = fam?.color ?? c.accent;
  const mono = fam?.mono ?? (fam?.name?.[0]?.toUpperCase() ?? 'F');

  // Tap the invite-code row to copy it to the clipboard (transient "Copied").
  const [copied, setCopied] = useState(false);
  const copyInvite = async () => {
    if (!fam?.inviteCode) return;
    try {
      await Clipboard.setStringAsync(fam.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Share the invite link (native share sheet / web share). Browsers without
  // navigator.share reject — fall back to copying the message.
  const [linkCopied, setLinkCopied] = useState(false);
  const shareInvite = async () => {
    if (!fam?.inviteCode) return;
    const message = inviteMessage(fam.name ?? 'our family', fam.inviteCode);
    try {
      await Share.share({ message, url: joinUrl(fam.inviteCode), title: `Join ${fam.name ?? 'our family'}` } as any);
    } catch {
      try {
        await Clipboard.setStringAsync(message);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
      } catch {}
    }
  };

  // Owner-only edit + delete. The legacy primary tree (treeId === uid) can't be
  // deleted, so the user is never left with no family at all.
  const owner = isOwner(fam?.role) || isOwner(family?.role);

  // Legacy trees predate invite codes — heal one in so the QR/share works.
  // The live doc subscription picks the write up and re-renders with the code.
  // healedRef stops a second write racing in before the snapshot returns (that
  // would regenerate the code and break already-shared links).
  const healedRef = useRef(false);
  useEffect(() => {
    if (!owner || !doc || doc.inviteCode || healedRef.current) return;
    healedRef.current = true;
    ensureInviteCode(treeId, (doc as any).surname || doc.name).catch((e) => console.warn('ensureInviteCode', (e as any)?.message ?? e));
  }, [owner, doc, treeId]);
  const isPrimary = treeId === user?.uid;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fName, setFName] = useState('');
  const [fRegion, setFRegion] = useState('');
  const [fEst, setFEst] = useState('');
  const [fSummary, setFSummary] = useState('');
  const [fColor, setFColor] = useState<string | undefined>(undefined);
  const [fJoinPolicy, setFJoinPolicy] = useState<JoinPolicy>('open');

  const startEdit = () => {
    setFName(fam?.name ?? ''); setFRegion(fam?.region ?? ''); setFEst(fam?.established ?? '');
    setFSummary(fam?.summary ?? ''); setFColor(fam?.color); setFJoinPolicy(fam?.joinPolicy ?? 'open'); setEditing(true);
  };
  const saveEdit = async () => {
    if (!user || !fName.trim()) return;
    setBusy(true);
    try {
      await updateFamily(treeId, user.uid, {
        name: fName.trim(), mono: monoOf(fName.trim()), region: fRegion.trim(),
        established: fEst.trim(), summary: fSummary.trim(), joinPolicy: fJoinPolicy, ...(fColor ? { color: fColor } : {}),
      });
      setEditing(false);
    } finally { setBusy(false); }
  };
  const removeFamily = () => {
    if (!user || isPrimary) return;
    const msg = `Delete "${fam?.name ?? 'this family'}"? Every member, link, and collaborator is permanently removed. This can't be undone.`;
    const go = async () => { setBusy(true); try { await deleteFamily(treeId, user.uid); onClose(); } finally { setBusy(false); } };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) go(); }
    else Alert.alert('Delete family', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  const inputStyle = {
    height: 46, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
    backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null),
  };

  const gens = useMemo(() => {
    if (!members.length) return 0;
    return Math.max(...computeGenerations(members, relationships).values()) + 1;
  }, [members, relationships]);
  const couples = countCouples(members, relationships);
  const stats: [string, number][] = [['Members', members.length], ['Generations', gens], ['Couples', couples]];

  const ownerEmail = collabs.find((x) => x.role === 'owner')?.email || fam?.ownerUid || '—';
  const meta: [IconName, string, string | undefined][] = [
    ['pin', 'Region', fam?.region],
    ['cake', 'Established', fam?.established],
    ['user', 'Owner', ownerEmail],
    ['link', 'Invite code', fam?.inviteCode],
  ];

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="info" title="Family info" sub={fam?.name} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}>
        {editing ? (
          <View style={{ gap: 12 }}>
            <Field label="Family name" c={c}><TextInput value={fName} onChangeText={setFName} placeholder="Family name" placeholderTextColor={c.mute} style={inputStyle} /></Field>
            <Field label="Region" c={c}><TextInput value={fRegion} onChangeText={setFRegion} placeholder="Region (optional)" placeholderTextColor={c.mute} style={inputStyle} /></Field>
            <Field label="Established" c={c}><TextInput value={fEst} onChangeText={setFEst} placeholder="Year (optional)" placeholderTextColor={c.mute} style={inputStyle} /></Field>
            <Field label="Summary" c={c}><TextInput value={fSummary} onChangeText={setFSummary} placeholder="A short description (optional)" placeholderTextColor={c.mute} multiline style={[inputStyle, { height: 92, paddingTop: 12, textAlignVertical: 'top' }]} /></Field>
            <Field label="Colour" c={c}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {FAMILY_COLORS.map((col) => {
                  const on = (fColor ?? color) === col;
                  return (
                    <Pressable key={col} onPress={() => setFColor(col)} style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper, borderWidth: 2, borderColor: on ? col : c.line }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: col }} />
                    </Pressable>
                  );
                })}
              </View>
            </Field>
            <Field label="Joining" c={c}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['open', 'approval'] as const).map((p) => {
                  const on = fJoinPolicy === p;
                  return (
                    <Pressable key={p} onPress={() => setFJoinPolicy(p)} style={{ flex: 1, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.paper }}>
                      <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>{p === 'open' ? 'Open' : 'Approval'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12, lineHeight: 17, marginTop: -4 }}>
              {fJoinPolicy === 'open' ? 'Anyone with the invite code joins instantly.' : 'Invite-code joins must be approved by an owner or admin.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable onPress={() => setEditing(false)} style={{ flex: 1, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line }}>
                <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEdit} disabled={busy || !fName.trim()} style={{ flex: 1, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: busy || !fName.trim() ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Save changes</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
        <>
        {/* identity */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper, borderWidth: 1.5, borderColor: color }}>
            <Text style={{ color, fontFamily: font.serif, fontSize: 28 }}>{mono}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 24 }}>{fam?.name ?? 'Family'}</Text>
            {fam?.kind ? (
              <View style={{ alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.accentSoft }}>
                <Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 11.5 }}>{fam.kind}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {fam?.summary ? <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 14.5, lineHeight: 22 }}>{fam.summary}</Text> : null}

        {fam?.photoUrl ? (
          <Image source={{ uri: fam.photoUrl }} style={{ width: '100%', height: 170, borderRadius: radius.lg, backgroundColor: c.paper2 }} resizeMode="cover" />
        ) : null}

        {/* actions — compact 2-up grid instead of four stacked rows */}
        {(() => {
          const actions: { key: string; icon: IconName; label: string; onPress: () => void; primary?: boolean }[] = [];
          if (onSwitchFamily) actions.push({ key: 'switch', icon: 'users', label: 'Switch family', onPress: onSwitchFamily, primary: true });
          if (canApprove && onUploadPhoto) actions.push({ key: 'photo', icon: 'image', label: fam?.photoUrl ? 'Update photo' : 'Upload photo', onPress: onUploadPhoto });
          if (onOpenEvents) actions.push({ key: 'events', icon: 'calendar', label: 'Family events', onPress: onOpenEvents });
          if (canApprove && onOpenMasterEdit) actions.push({ key: 'edit-all', icon: 'edit', label: 'Edit all members', onPress: onOpenMasterEdit });
          if (!actions.length) return null;
          return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {actions.map((a) => (
                <Pressable key={a.key} onPress={a.onPress}
                  style={({ pressed }) => ({
                    flexBasis: '48%', flexGrow: 1, height: 46, borderRadius: radius.md,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    backgroundColor: a.primary ? c.accentSoft : 'transparent',
                    borderWidth: a.primary ? 0 : 1, borderColor: c.line,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}>
                  <Icon name={a.icon} size={16} color={a.primary ? c.accent : c.inkSoft} />
                  <Text numberOfLines={1} style={{ color: a.primary ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          );
        })()}

        {/* stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {stats.map(([lb, v]) => (
            <GlassSurface key={lb} rounded={radius.lg} style={{ flex: 1 }}>
              <View style={{ padding: 13 }}>
                <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 26, lineHeight: 28 }}>{v}</Text>
                <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>{lb}</Text>
              </View>
            </GlassSurface>
          ))}
        </View>

        {/* metadata */}
        <GlassSurface rounded={radius.lg}>
          <View style={{ paddingHorizontal: 16 }}>
            {meta.filter((r) => r[2]).map((r, i, a) => {
              const isInvite = r[1] === 'Invite code';
              const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 13, paddingVertical: 13, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderColor: c.lineSoft };
              const inner = (
                <>
                  <Icon name={r[0]} size={18} color={c.mute} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>{r[1]}</Text>
                    <Text style={{ color: isInvite ? c.accent : c.ink, fontFamily: isInvite ? font.monoSemi : font.sansMed, fontSize: 14.5, marginTop: 2 }}>{r[2]}</Text>
                  </View>
                  {isInvite ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Icon name={copied ? 'check' : 'copy'} size={15} color={c.accent} />
                      <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 12 }}>{copied ? 'Copied' : 'Copy'}</Text>
                    </View>
                  ) : null}
                </>
              );
              return isInvite ? (
                <Pressable key={r[1]} onPress={copyInvite} style={({ pressed }) => ({ ...rowStyle, opacity: pressed ? 0.6 : 1 })}>{inner}</Pressable>
              ) : (
                <View key={r[1]} style={rowStyle}>{inner}</View>
              );
            })}
          </View>
        </GlassSurface>

        {/* invite QR + share link */}
        {fam?.inviteCode ? (
          <GlassSurface rounded={radius.lg}>
            <View style={{ padding: 16, alignItems: 'center', gap: 12 }}>
              <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Scan to join</Text>
              {/* fixed black-on-white so the code scans in both themes */}
              <View style={{ padding: 10, borderRadius: radius.md, backgroundColor: '#ffffff' }}>
                <QRCode value={joinUrl(fam.inviteCode)} size={148} color="#111111" backgroundColor="#ffffff" />
              </View>
              <Text selectable numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{joinUrl(fam.inviteCode)}</Text>
              <Pressable onPress={shareInvite} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 46, borderRadius: radius.md, backgroundColor: c.accent, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <Icon name="share" size={16} color={c.accentInk} />
                <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14 }}>{linkCopied ? 'Link copied' : 'Share invite link'}</Text>
              </Pressable>
            </View>
          </GlassSurface>
        ) : null}

        {/* collaborators */}
        <View>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 }}>
            {collabs.length} {collabs.length === 1 ? 'person has' : 'people have'} access
          </Text>
          <View style={{ gap: 8 }}>
            {collabs.map((cl) => {
              const m = members.find((x) => x.associatedUserId === cl.uid) || { id: cl.uid, name: cl.email || 'Member', gender: 'other' as const };
              return (
                <GlassSurface key={cl.uid} rounded={radius.md}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11 }}>
                    <Avatar m={m} size={38} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 14 }}>{m.name}</Text>
                      {cl.email ? <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.sans, fontSize: 11.5 }}>{cl.email}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: cl.role === 'owner' ? c.accentSoft : c.paper, borderWidth: cl.role === 'owner' ? 0 : 1, borderColor: c.line }}>
                        <Text style={{ color: cl.role === 'owner' ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12, textTransform: 'capitalize' }}>{normalizeRole(cl.role)}</Text>
                      </View>
                      {canManage && cl.role !== 'owner' && cl.uid !== user?.uid ? (
                        <Pressable onPress={() => setMemberRole(treeId, cl.uid, normalizeRole(cl.role) === 'admin' ? 'member' : 'admin')} hitSlop={6}>
                          <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 11 }}>{normalizeRole(cl.role) === 'admin' ? 'Make member' : 'Make admin'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </GlassSurface>
              );
            })}
            {collabs.length === 0 ? (
              <GlassSurface rounded={radius.md}><Text style={{ color: c.mute, fontFamily: font.sans, padding: 16, textAlign: 'center' }}>Just you so far.</Text></GlassSurface>
            ) : null}
          </View>
        </View>

        {/* pending join requests (owner/admin) */}
        {canApprove && requests.some((r) => r.status === 'pending') ? (
          <View>
            <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 }}>Join requests</Text>
            <View style={{ gap: 8 }}>
              {requests.filter((r) => r.status === 'pending').map((r) => (
                <GlassSurface key={r.uid} rounded={radius.md}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="user" size={18} color={c.accent} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 14 }}>{r.email || r.name || r.uid}</Text>
                      <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 11.5 }}>wants to join</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => rejectJoinRequest(treeId, r.uid)} hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, borderColor: c.line }}>
                        <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12 }}>Reject</Text>
                      </Pressable>
                      <Pressable onPress={() => approveJoinRequest(treeId, r.uid, r.email)} hitSlop={6} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.md, backgroundColor: c.accent }}>
                        <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 12 }}>Approve</Text>
                      </Pressable>
                    </View>
                  </View>
                </GlassSurface>
              ))}
            </View>
          </View>
        ) : null}

        {/* owner actions */}
        {owner ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Pressable onPress={startEdit} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Icon name="edit" size={17} color={c.inkSoft} /><Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 14.5 }}>Edit family details</Text>
            </Pressable>
            {!isPrimary ? (
              <Pressable onPress={removeFamily} disabled={busy} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: c.danger, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <Icon name="trash" size={17} color={c.danger} /><Text style={{ color: c.danger, fontFamily: font.sansSemi, fontSize: 14.5 }}>Delete family</Text>
              </Pressable>
            ) : (
              <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12, textAlign: 'center' }}>Your primary family can't be deleted.</Text>
            )}
          </View>
        ) : null}
        </>
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, c, children }: { label: string; c: ReturnType<typeof useTheme>['c']; children: React.ReactNode }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginLeft: 2 }}>{label}</Text>
      {children}
    </View>
  );
}
