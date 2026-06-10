// Indian mobile number normalization for the OTP login flow.
// Storage canonical: bare 10-digit "9876543210" — no +91, no spaces.
// At the controller boundary we accept any common form (+91 / 91 / spaces /
// dashes) and strip down to the 10 digits before persisting / sending SMS.
//
// Lookup variants exist for legacy data where rows may have been saved with
// the country code or a leading +. Newly-created rows always use the bare
// form, so the variant set shrinks to one entry for them.

const INDIAN_MOBILE_REGEX = /^(?:91)?[6-9]\d{9}$/;

export const normalizePhoneNumber = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
};

export const isValidPhoneNumber = (value) =>
  INDIAN_MOBILE_REGEX.test(normalizePhoneNumber(value));

// All the forms the same number might be stored as in the DB. Used when
// looking up a user — once new sign-ups normalize on write, this set
// collapses to one entry for them.
export const getPhoneLookupVariants = (value) => {
  const bare = normalizePhoneNumber(value);
  if (!bare) return [];
  const variants = new Set([bare, `91${bare}`, `+91${bare}`]);
  return Array.from(variants);
};

export const maskPhoneNumber = (value) => {
  const n = normalizePhoneNumber(value);
  if (n.length !== 10) return String(value ?? '').trim();
  return `+91 ${n.slice(0, 2)}XXXXXX${n.slice(-2)}`;
};
