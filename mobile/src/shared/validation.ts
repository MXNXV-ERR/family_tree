// Smart member validation. Name required; optional fields format-checked only
// when filled; date sanity (death >= birth, birth not in future).
import type { Member } from './types';

export type FieldErrors = Partial<Record<keyof Member, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;

export function validateMember(m: Partial<Member>): FieldErrors {
  const e: FieldErrors = {};

  if (!m.name || !m.name.trim()) e.name = 'Name is required';

  if (m.email && !EMAIL_RE.test(m.email.trim())) e.email = 'Invalid email address';
  if (m.phone && !PHONE_RE.test(m.phone.trim())) e.phone = 'Invalid phone number';

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const birth = m.birthDate ? new Date(m.birthDate) : null;
  const death = m.deathDate ? new Date(m.deathDate) : null;

  if (m.birthDate && Number.isNaN(birth!.getTime())) e.birthDate = 'Invalid date';
  else if (birth && birth > today) e.birthDate = 'Birth date is in the future';

  if (m.deathDate && Number.isNaN(death!.getTime())) e.deathDate = 'Invalid date';
  else if (death && birth && death < birth) e.deathDate = 'Death date is before birth date';

  return e;
}

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;
