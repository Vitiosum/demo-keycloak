// app.js: keycloak-js on a static page. Sign in with OpenID Connect (code + PKCE S256)
// on the Keycloak add-on, print the access token as a passport, sign out.
// Settings come from config.js (window.KEYCLOAK_CONFIG): only `url` changes per deployment.
import { decodeSegment, formatTime, specimen, splitJwt, toPassport } from './passport.js';
import * as ui from './render.js';

const config = window.KEYCLOAK_CONFIG || {};
const baseUrl = String(config.url || '').replace(/\/+$/, '');
const realm = String(config.realm || '');
const realmUrl = `${baseUrl}/realms/${encodeURIComponent(realm)}`;
const CARRY = 'poste-frontiere:carry'; // ledger lines kept across the Keycloak redirects

let keycloak = null;
let countdown = null;

// ---------- Ledger ----------

function log(text, code, carry = false) {
  const entry = { time: Date.now(), text, code };
  ui.addLog(entry);
  if (!carry) return;
  try {
    const kept = JSON.parse(sessionStorage.getItem(CARRY) || '[]');
    sessionStorage.setItem(CARRY, JSON.stringify([...kept, entry].slice(-4)));
  } catch { /* storage blocked: the ledger only shows this page */ }
}

// Shown on every load, forgotten once init settles: check-sso may bounce through
// Keycloak once more (prompt=none) before the page stays.
function replayCarried() {
  try {
    JSON.parse(sessionStorage.getItem(CARRY) || '[]').forEach(ui.addLog);
  } catch { /* nothing kept */ }
}

function forgetCarried() {
  try { sessionStorage.removeItem(CARRY); } catch { /* storage blocked */ }
}

// ---------- Passport ----------

function showSpecimen() {
  const { claims, header } = specimen(realmUrl);
  ui.renderPassport(toPassport(claims, header), { specimen: true });
  ui.setToken(null);
  clearInterval(countdown);
}

function showToken(animate) {
  const parts = splitJwt(keycloak.token);
  const header = decodeSegment(parts.header) || {};
  const claims = keycloak.tokenParsed || {};
  const passport = toPassport(claims, header);
  ui.renderPassport(passport, { specimen: false, animate });
  ui.setToken(keycloak.token, parts, header, claims);
  ui.setSign('in', `Bienvenue, ${passport.givenNames || passport.username || 'voyageur'}`,
    `Barrière levée. Jeton valable jusqu'à ${formatTime(claims.exp)}.`);
  ui.setButtons('in');
  clearInterval(countdown);
  const now = () => Date.now() / 1000 - (keycloak.timeSkew || 0);
  ui.tick(claims.exp, now());
  countdown = setInterval(() => ui.tick(claims.exp, now()), 1000);
  return passport;
}

function fail(title, error) {
  const detail = error?.message || error?.error_description || error?.error || String(error || '');
  ui.setSign('error', 'Poste injoignable',
    `${title}. Vérifiez l'adresse dans config.js et que le royaume « ${realm} » existe.`);
  ui.setButtons('out');
  log(`${title} : ${detail}`);
  console.error(title, error);
}

// ---------- Buttons ----------

function wireButtons() {
  document.getElementById('btn-login').addEventListener('click', () => {
    if (!keycloak) return;
    ui.setSign('busy', 'Direction le guichet', `Redirection vers la page de connexion du royaume ${realm}…`);
    ui.setButtons('busy');
    log('Redirection vers la page de connexion (code d’autorisation + PKCE S256).',
      'GET /protocol/openid-connect/auth', true);
    keycloak.login().catch((error) => fail('La redirection a échoué', error));
  });

  document.getElementById('btn-refresh').addEventListener('click', async () => {
    ui.setButtons('busy');
    try {
      await keycloak.updateToken(-1);
      showToken(false);
      ui.flashExpiry();
      log(`Jeton renouvelé avec le refresh token, nouvelle expiration à ${formatTime(keycloak.tokenParsed.exp)}.`,
        'POST /protocol/openid-connect/token  grant_type=refresh_token');
    } catch (error) {
      ui.setButtons('in');
      log('Renouvellement refusé : la session Keycloak est terminée. Repassez le contrôle.');
      console.error(error);
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    if (!keycloak) return;
    clearInterval(countdown);
    ui.stampExit();
    ui.setSign('busy', 'Sortie en cours', 'Tampon de sortie apposé. Keycloak ferme la session, puis vous ramène ici.');
    ui.setButtons('busy');
    log('Tampon de sortie : fin de la session Keycloak, retour à la page.', 'GET /protocol/openid-connect/logout', true);
    const pause = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 1400;
    setTimeout(() => keycloak.logout({ redirectUri: window.location.origin }), pause);
  });
}

// ---------- Start ----------

async function start() {
  ui.drawPaper();
  ui.showPlatform();
  ui.showEndpoints(realmUrl, realm);
  ui.wireTokenPanel();
  wireButtons();
  showSpecimen();
  replayCarried();

  if (!baseUrl || !realm || !config.clientId) {
    fail('config.js est absent ou incomplet', 'window.KEYCLOAK_CONFIG needs url, realm and clientId');
    return;
  }

  let Keycloak;
  try {
    ({ default: Keycloak } = await import('./keycloak.min.js'));
  } catch (error) {
    fail('La bibliothèque keycloak-js ne s’est pas chargée', error);
    return;
  }

  keycloak = new Keycloak({ url: baseUrl, realm, clientId: config.clientId });
  keycloak.onTokenExpired = () => {
    ui.setSign('expired', document.getElementById('sign-title').textContent,
      `Jeton expiré à ${formatTime(keycloak.tokenParsed?.exp)} : renouvelez-le, ou repassez le contrôle.`);
    log('Le jeton d’accès a expiré (claim exp).');
  };

  log(`Poste ouvert : keycloak-js relié au royaume ${realm}, client ${config.clientId}.`, `new Keycloak({ url, realm: '${realm}', clientId: '${config.clientId}' })`);
  log('check-sso : le royaume vérifie, sans formulaire, si ce navigateur a déjà une session.', "keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' })");

  let authenticated;
  try {
    authenticated = await keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' });
  } catch (error) {
    forgetCarried();
    fail('Keycloak n’a pas répondu à l’initialisation', error);
    return;
  }
  forgetCarried();

  if (authenticated) {
    log('Session reconnue : code d’autorisation échangé contre un jeton (PKCE S256).', 'POST /protocol/openid-connect/token');
    const passport = showToken(true);
    log(`Passeport imprimé depuis keycloak.tokenParsed : ${passport.claimCount} claims, ${passport.roles.length} rôles.`);
  } else {
    ui.setSign('out', 'Aucun passeport présenté',
      'Le passeport affiché est un spécimen fictif. Passez le contrôle pour recevoir le vôtre.');
    ui.setButtons('out');
    log('Aucune session : pas de jeton, le spécimen reste affiché.');
  }
}

start();
