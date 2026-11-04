// passport.js: turns a Keycloak access token into the fields of a passport.
// Pure functions, no DOM: the browser and `node --test` load the same file.

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
const pad = (n) => String(n).padStart(2, '0');

// The fictional passport shown before sign-in. Same claims as a real Keycloak 26
// access token for a new user of a new realm (default roles included), fake values.
export function specimen(realmUrl) {
  const issuedAt = 1767254400; // 1 Jan 2026, 08:00 UTC
  return {
    header: { alg: 'RS256', typ: 'JWT', kid: 'specimen' },
    claims: {
      exp: issuedAt + 300,
      iat: issuedAt,
      auth_time: issuedAt,
      jti: '00000000-0000-0000-0000-000000000000',
      iss: realmUrl,
      aud: 'account',
      sub: '00000000-0000-0000-0000-000000000000',
      typ: 'Bearer',
      azp: 'demo-client',
      sid: '00000000-0000-0000-0000-000000000000',
      realm_access: { roles: ['default-roles-demo', 'offline_access', 'uma_authorization'] },
      resource_access: { account: { roles: ['manage-account', 'manage-account-links', 'view-profile'] } },
      scope: 'openid email profile',
      email_verified: true,
      name: 'Camille Voyageur',
      preferred_username: 'camille.voyageur',
      given_name: 'Camille',
      family_name: 'Voyageur',
      email: 'camille.voyageur@exemple.test',
    },
  };
}

export function formatDate(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const d = new Date(seconds * 1000);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const d = new Date(seconds * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// "4 min 07 s" left before exp, or null once expired.
export function timeLeft(exp, nowSeconds) {
  const left = Math.floor(exp - nowSeconds);
  if (!Number.isFinite(left) || left <= 0) return null;
  const m = Math.floor(left / 60);
  return m > 0 ? `${m} min ${pad(left % 60)} s` : `${left} s`;
}

// https://host/realms/demo -> "demo"
export function realmOf(iss) {
  const match = /\/realms\/([^/?#]+)/.exec(iss || '');
  return match ? decodeURIComponent(match[1]) : '';
}

// ICAO 9303 machine readable zone: A-Z, 0-9 and the filler "<".
export function mrzText(value, length) {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<');
  return (text + '<'.repeat(length)).slice(0, length);
}

// ICAO 9303 check digit: weights 7, 3, 1; digits as is, A=10 … Z=35, "<"=0.
export function checkDigit(text) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const v = c === '<' ? 0 : /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 55;
    sum += v * weights[i % 3];
  }
  return String(sum % 10);
}

function yymmdd(seconds) {
  if (!Number.isFinite(seconds)) return '<<<<<<';
  const d = new Date(seconds * 1000);
  return `${pad(d.getUTCFullYear() % 100)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

// Two 44-character lines of a TD3 passport, built from the token. The birth date
// and sex are not in the token: left as fillers, as ICAO allows for unknown data.
export function mrz({ realm, surname, givenNames, sub, exp, username }) {
  const code = mrzText(realm, 3);
  const trim = (text) => mrzText(text, 39).replace(/^<+|<+$/g, '');
  const name = (`${trim(surname)}<<${trim(givenNames)}` + '<'.repeat(39)).slice(0, 39);
  const line1 = `P<${code}${name}`;

  const docNumber = mrzText(String(sub || '').replace(/-/g, ''), 9);
  const birth = '<<<<<<';
  const expiry = yymmdd(exp);
  const personal = mrzText(username, 14);
  const d1 = checkDigit(docNumber);
  const d2 = checkDigit(birth);
  const d3 = checkDigit(expiry);
  const d4 = checkDigit(personal);
  const composite = checkDigit(docNumber + d1 + birth + d2 + expiry + d3 + personal + d4);
  const line2 = `${docNumber}${d1}${code}${birth}${d2}<${expiry}${d3}${personal}${d4}${composite}`;
  return [line1, line2];
}

// Realm roles then client roles, each with the authority that granted it.
export function rolesOf(claims) {
  const roles = [];
  for (const name of claims?.realm_access?.roles || []) roles.push({ name, from: 'realm' });
  for (const [client, access] of Object.entries(claims?.resource_access || {})) {
    for (const name of access?.roles || []) roles.push({ name, from: client });
  }
  return roles;
}

// header.payload.signature, as three strings.
export function splitJwt(token) {
  const [header = '', payload = '', signature = ''] = String(token || '').split('.');
  return { header, payload, signature };
}

// One base64url JWT segment -> object (null if it is not JSON).
export function decodeSegment(segment) {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// Everything the passport prints, with the claim each field comes from.
export function toPassport(claims = {}, header = {}) {
  const realm = realmOf(claims.iss);
  const nameParts = String(claims.name || '').trim().split(/\s+/).filter(Boolean);
  const surname = claims.family_name || (nameParts.length > 1 ? nameParts.at(-1) : '') || claims.preferred_username || '';
  const givenNames = claims.given_name || (nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || '');
  const username = claims.preferred_username || '';
  return {
    realm,
    code: mrzText(realm, 3).replace(/<+$/, '') || '—',
    surname,
    givenNames,
    username,
    email: claims.email || '',
    emailVerified: claims.email_verified === true,
    sub: claims.sub || '',
    iss: claims.iss || '',
    issuedAt: claims.iat,
    authTime: claims.auth_time ?? claims.iat,
    expiresAt: claims.exp,
    client: claims.azp || '',
    scope: claims.scope || '',
    sid: claims.sid || claims.session_state || '',
    alg: header.alg || '',
    kid: header.kid || '',
    roles: rolesOf(claims),
    claimCount: Object.keys(claims).length,
    mrz: mrz({ realm, surname, givenNames, sub: claims.sub, exp: claims.exp, username }),
  };
}

// Small stable hash, to place and tilt each stamp the same way on every render.
export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
