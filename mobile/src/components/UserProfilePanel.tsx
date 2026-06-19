// User profile editor (Settings → Your profile). Edits the signed-in user's
// own profile doc (users/{uid}) — distinct from any family member. Member-like
// details here can be pushed onto a claimed node from the member profile screen
// ("Sync my profile"). Also holds the per-user regional-language override.
import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useTheme, font, radius } from '../theme/theme';
import { SheetHead } from './panelChrome';
import { DateField } from '../ui/DateField';
import { useAuth } from '../firebase/AuthContext';
import { useUserProfile } from '../firebase/UserProfileContext';
import { updateUserProfile } from '../firebase/userProfile';
import type { UserProfile } from '../shared/types';

const GENDERS: [NonNullable<UserProfile['gender']>, string][] = [['male', 'Male'], ['female', 'Female'], ['other', 'Other']];

export function UserProfilePanel({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const profile = useUserProfile();

  const [name, setName] = useState(profile?.name ?? user?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [gender, setGender] = useState<UserProfile['gender']>(profile?.gender);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [occupation, setOccupation] = useState(profile?.occupation ?? '');
  const [about, setAbout] = useState(profile?.about ?? '');
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    height: 46, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
    backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null),
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await updateUserProfile(user.uid, {
        name: name.trim(), birthDate: birthDate.trim(), gender,
        phone: phone.trim(), location: location.trim(), occupation: occupation.trim(),
        about: about.trim(),
      });
      onBack();
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="user" title="Your profile" sub={user?.email ?? undefined} onClose={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }}>
        <Field label="Name" c={c}><TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={c.mute} style={inputStyle} /></Field>

        <Field label="Gender" c={c}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {GENDERS.map(([g, lb]) => {
              const on = gender === g;
              return (
                <Pressable key={g} onPress={() => setGender(g)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: on ? c.accentSoft : c.paper, borderWidth: 1.5, borderColor: on ? c.accent : c.line }}>
                  <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 14 }}>{lb}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Born" c={c}><DateField value={birthDate} onChange={setBirthDate} placeholder="Select date" /></Field>
        <Field label="Phone" c={c}><TextInput value={phone} onChangeText={setPhone} placeholder="Phone (optional)" placeholderTextColor={c.mute} keyboardType="phone-pad" style={inputStyle} /></Field>
        <Field label="Location" c={c}><TextInput value={location} onChangeText={setLocation} placeholder="City / location (optional)" placeholderTextColor={c.mute} style={inputStyle} /></Field>
        <Field label="Occupation" c={c}><TextInput value={occupation} onChangeText={setOccupation} placeholder="Occupation (optional)" placeholderTextColor={c.mute} style={inputStyle} /></Field>
        <Field label="About" c={c}><TextInput value={about} onChangeText={setAbout} placeholder="A short bio (optional)" placeholderTextColor={c.mute} multiline style={[inputStyle, { height: 92, paddingTop: 12, textAlignVertical: 'top' }]} /></Field>

        <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
          Tip: open your own node in the family and tap “Sync my profile” to copy these details onto it.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Pressable onPress={onBack} style={{ flex: 1, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line }}>
            <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 15 }}>Back</Text>
          </Pressable>
          <Pressable onPress={save} disabled={busy || !name.trim()} style={{ flex: 1, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: busy || !name.trim() ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Save profile</Text>}
          </Pressable>
        </View>
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
