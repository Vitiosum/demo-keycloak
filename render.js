// render.js: draws the border post. Passport fields, stamps, sign, ledger, raw token.
// No Keycloak here: app.js hands over plain data. Every value from the token goes
// through textContent, never innerHTML.
import { formatDate, formatTime, hash, timeLeft } from './passport.js';

const SVG = 'http://www.w3.org/2000/svg';
const $ = (selector) => document.querySelector(selector);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (parent) parent.appendChild(node);
  return node;
}

function label(parent, attrs, content) {
  const node = el('text', attrs, parent);
  node.textContent = content;
  return node;
}

function setField(name, value) {
  for (const node of document.querySelectorAll(`[data-f="${name}"]`)) node.textContent = value || '—';
}

const stamp = (seconds) => `${formatDate(seconds)}, ${formatTime(seconds).slice(0, 5)}`;

// ---------- Security paper: woven rosettes and waves, drawn once ----------

function ring(parent, cx, cy, base, amp, lobes, copies, cls) {
  for (let i = 0; i < copies; i++) {
    const phase = (i * Math.PI) / copies;
    let d = '';
    for (let step = 0; step <= 360; step++) {
      const a = (step / 360) * Math.PI * 2;
      const r = base + amp * Math.sin(lobes * a + phase);
      d += `${step ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    }
    el('path', { d: `${d}Z`, class: cls }, parent);
  }
}

function drawGuilloche(svg, seed) {
  const W = 320;
  const H = 480;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const g = el('g', { fill: 'none' }, svg);
  for (let i = 0; i < 16; i++) {
    let d = '';
    for (let x = -10; x <= W + 10; x += 5) {
      const y = 96 + i * 3.2 + 16 * Math.sin(x / 41 + i * 0.21 + seed) + 6 * Math.sin(x / 14 - i * 0.37);
      d += `${x === -10 ? 'M' : 'L'}${x} ${y.toFixed(1)}`;
    }
    el('path', { d, class: i % 2 ? 'g1' : 'g2' }, g);
  }
  ring(g, W * 0.72, H * 0.7, 84, 9, 22, 8, 'g1');
  ring(g, W * 0.72, H * 0.7, 52, 6, 14, 6, 'g2');
  ring(g, W * 0.16, H * 0.97, 64, 8, 18, 6, 'g2');
}

export function drawPaper() {
  document.querySelectorAll('.guilloche').forEach((svg, i) => drawGuilloche(svg, i * 1.7));
}

// ---------- Portrait: a silhouette on a rosette tuned by the sub ----------

function drawPhoto(sub) {
  const svg = $('#photo');
  svg.replaceChildren();
  const h = hash(sub || 'specimen');
  el('rect', { width: 90, height: 116, class: 'photo__bg' }, svg);
  const g = el('g', { fill: 'none' }, svg);
  ring(g, 45, 52, 30 + (h % 9), 5, 10 + (h % 7), 6, 'photo__line');
  el('ellipse', { cx: 45, cy: 45, rx: 16.5, ry: 20.5, class: 'photo__ink' }, svg);
  el('path', { d: 'M8 116c2-27 17-41 37-41s35 14 37 41z', class: 'photo__ink' }, svg);
}

// ---------- Stamps ----------

let stampCount = 0;

function inkGroup(parent, x, y, angle, color, delay) {
  const outer = el('g', { transform: `translate(${x} ${y}) rotate(${angle})`, class: `ink ink--${color}` }, parent);
  const inner = el('g', { filter: 'url(#ink)' }, outer);
  if (delay !== null && !reducedMotion()) {
    inner.classList.add('lands');
    inner.style.animationDelay = `${delay}ms`;
  }
  return inner;
}

function roundStamp(parent, { x, y, angle, color, top, bottom, line1, line2, delay }) {
  const g = inkGroup(parent, x, y, angle, color, delay);
  const id = `arc-${++stampCount}`;
  el('circle', { r: 56, fill: 'none', stroke: 'currentColor', 'stroke-width': 3 }, g);
  el('circle', { r: 41, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }, g);
  el('path', { id: `${id}-t`, d: 'M-47 0A47 47 0 0 1 47 0', fill: 'none' }, g);
  el('path', { id: `${id}-b`, d: 'M-49 0A49 49 0 0 0 49 0', fill: 'none' }, g);
  const t = el('text', { class: 'stamp__arc' }, g);
  const tp = el('textPath', { href: `#${id}-t`, startOffset: '50%', 'text-anchor': 'middle' }, t);
  tp.textContent = top;
  const b = el('text', { class: 'stamp__arc', 'dominant-baseline': 'hanging' }, g);
  const bp = el('textPath', { href: `#${id}-b`, startOffset: '50%', 'text-anchor': 'middle' }, b);
  bp.textContent = bottom;
  el('use', { href: '#plane', x: -8, y: -32, width: 16, height: 16, fill: 'currentColor', transform: 'rotate(90 0 -24)' }, g);
  label(g, { y: 4, 'text-anchor': 'middle', class: 'stamp__date' }, line1);
  label(g, { y: 24, 'text-anchor': 'middle', class: 'stamp__time' }, line2);
  return g;
}

function boxStamp(parent, { x, y, angle, color, w, h, kicker, name, foot, shape, delay, big }) {
  const g = inkGroup(parent, x, y, angle, color, delay);
  if (shape === 'oval') {
    el('ellipse', { rx: w / 2, ry: h / 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }, g);
    el('ellipse', { rx: w / 2 - 5, ry: h / 2 - 5, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.9 }, g);
  } else {
    el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 4, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }, g);
    el('rect', { x: -w / 2 + 4, y: -h / 2 + 4, width: w - 8, height: h - 8, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.9 }, g);
  }
  const nameSize = big ? 24 : 14;
  const oval = shape === 'oval';
  label(g, { y: big ? -14 : oval ? -12 : -10, 'text-anchor': 'middle', class: 'stamp__kicker' }, kicker);
  const n = label(g, { y: big ? 11 : 6, 'text-anchor': 'middle', class: 'stamp__name', 'font-size': nameSize }, name);
  const room = w - (shape === 'oval' ? 34 : 18);
  if (name.length * nameSize * 0.5 > room) {
    n.setAttribute('textLength', room);
    n.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  }
  label(g, { y: big ? 26 : oval ? 16 : 18, 'text-anchor': 'middle', class: 'stamp__foot' }, foot);
  return g;
}

const SLOTS = [[224, 46], [224, 122], [80, 172], [224, 198], [82, 250], [214, 268], [150, 146]];
const COLORS = ['violet', 'orange', 'violet', 'cherry-soft', 'orange', 'violet', 'orange'];

function drawStamps(p, { specimen, animate }) {
  const svg = $('#stamps');
  svg.replaceChildren();
  const delay = (i) => (animate ? 250 + i * 140 : null);
  roundStamp(svg, {
    x: 78, y: 70, angle: -9, color: 'green', delay: delay(0),
    top: specimen ? 'SPÉCIMEN · ENTRÉE' : `ENTRÉE · ${p.realm.toUpperCase()}`,
    bottom: 'KEYCLOAK · CLEVER CLOUD',
    line1: formatDate(p.authTime),
    line2: formatTime(p.authTime).slice(0, 5),
  });
  const roles = p.roles.slice(0, SLOTS.length);
  const hidden = p.roles.length - roles.length;
  roles.forEach((role, i) => {
    const h = hash(role.name + role.from);
    const [x, y] = SLOTS[i];
    const last = hidden > 0 && i === roles.length - 1;
    boxStamp(svg, {
      x: x + ((h >>> 3) % 9) - 4,
      y: y + ((h >>> 7) % 7) - 3,
      angle: (h % 19) - 9,
      color: COLORS[i],
      shape: role.from === 'realm' ? 'rect' : 'oval',
      w: 134,
      h: role.from === 'realm' ? 52 : 62,
      kicker: role.from === 'realm' ? `VISA · ROYAUME ${p.realm.toUpperCase()}` : `VISA · CLIENT ${role.from.toUpperCase()}`,
      name: last ? `+ ${hidden + 1} visas` : role.name,
      foot: role.from === 'realm' ? 'realm_access' : 'resource_access',
      delay: delay(i + 1),
    });
  });
  svg.setAttribute('aria-label', `Tampons : entrée, puis ${p.roles.map((r) => r.name).join(', ') || 'aucun rôle'}`);
  setField('roleCount', String(p.roles.length));
}

// The red stamp of the logout, over the visas.
export function stampExit() {
  const now = Date.now() / 1000;
  boxStamp($('#stamps'), {
    x: 150, y: 150, angle: -14, color: 'cherry', shape: 'rect', w: 196, h: 76, big: true,
    kicker: 'SORTIE · FIN DE SESSION', name: 'SORTIE', foot: stamp(now), delay: 0,
  });
}

// ---------- Passport ----------

export function renderPassport(p, { specimen, animate = false }) {
  $('#passport').dataset.mode = specimen ? 'specimen' : 'real';
  $('#specimen-ribbon').hidden = !specimen;
  setField('realm', p.realm);
  setField('code', p.code);
  setField('surname', p.surname);
  setField('givenNames', p.givenNames);
  setField('username', p.username);
  setField('sub', p.sub);
  setField('iss', p.iss);
  setField('issued', stamp(p.issuedAt));
  setField('expires', stamp(p.expiresAt));
  setField('left', specimen ? `durée de vie : ${Math.round((p.expiresAt - p.issuedAt) / 60)} min` : '');
  setField('email', p.email ? `${p.email}${p.emailVerified ? '  ✓ vérifié' : ''}` : '');
  setField('scope', p.scope);
  setField('client', p.client);
  setField('seal', p.alg ? `${p.alg}${p.kid ? `, kid ${p.kid.slice(0, 8)}` : ''}` : '');
  setField('sid', p.sid);
  setField('mrz1', p.mrz[0]);
  setField('mrz2', p.mrz[1]);
  $('.f--expiry').classList.remove('is-expired');
  drawPhoto(p.sub);
  drawStamps(p, { specimen, animate });
}

// Live countdown on the expiry field.
export function tick(exp, nowSeconds) {
  const left = timeLeft(exp, nowSeconds);
  setField('left', left ? `valable encore ${left}` : 'expiré');
  $('.f--expiry').classList.toggle('is-expired', !left);
}

export function flashExpiry() {
  const field = $('.f--expiry');
  field.classList.remove('is-renewed');
  void field.offsetWidth;
  field.classList.add('is-renewed');
}

// ---------- Sign, barrier and buttons ----------

export function setSign(state, title, text) {
  $('#booth').dataset.state = state;
  $('#sign-title').textContent = title;
  $('#sign-text').textContent = text;
}

// mode: 'out' (login), 'in' (refresh + logout), 'busy' (same buttons, disabled)
export function setButtons(mode) {
  for (const id of ['#btn-login', '#btn-refresh', '#btn-logout']) $(id).disabled = mode === 'busy';
  if (mode === 'busy') return;
  $('#btn-login').hidden = mode === 'in';
  $('#btn-refresh').hidden = mode !== 'in';
  $('#btn-logout').hidden = mode !== 'in';
  $('#booth-hint').textContent = mode === 'in'
    ? 'Renouveler : nouveau jeton avec le refresh token, sans formulaire. Sortir : fin de la session Keycloak.'
    : "Connexion sur la page du royaume (code d'autorisation + PKCE S256), puis retour ici.";
}

export function showEndpoints(realmUrl, realm) {
  $('#ep-realm').textContent = realmUrl;
  $('#lead-realm').textContent = realm;
  $('#pf-keycloak').textContent = realmUrl;
}

// ---------- Running on Clever Cloud ----------

export function showPlatform() {
  const host = window.location.host;
  const local = window.location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  $('#pf-host').textContent = host || 'fichier local';
  $('#pf-runtime').textContent = local ? 'Local, serveur statique' : 'Static, fichiers servis tels quels';
  $('#pf-vars').textContent = 'aucune : une page statique ne lit pas l’environnement';
  $('#pf-pill').textContent = local ? 'Local' : 'Static runtime';
  $('#live-text').textContent = local ? 'Local' : 'En ligne sur Clever Cloud';
  if (!local) {
    $('#live-pill').className = 'cc-pill cc-pill--live';
    $('#live-pill .cc-dot').className = 'cc-dot';
  }
}

// ---------- Ledger ----------

export function addLog({ time, text, code }) {
  const list = $('#log');
  const item = document.createElement('li');
  const when = document.createElement('time');
  when.textContent = formatTime(time / 1000);
  const what = document.createElement('p');
  what.textContent = text;
  item.append(when, what);
  if (code) {
    const detail = document.createElement('code');
    detail.textContent = code;
    item.append(detail);
  }
  list.append(item);
  while (list.children.length > 12) list.firstElementChild.remove();
}

// ---------- Raw token ----------

let fullToken = '';

export function setToken(token, parts, header, payload) {
  fullToken = token || '';
  const toggle = $('#token-toggle');
  const copy = $('#token-copy');
  toggle.disabled = !fullToken;
  copy.disabled = !fullToken;
  $('#token-hint').hidden = Boolean(fullToken);
  if (!fullToken) {
    $('#token-panel').hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Voir le jeton brut';
    return;
  }
  const [h, p, s] = $('#token-jwt').children;
  h.textContent = parts.header;
  p.textContent = parts.payload;
  s.textContent = parts.signature;
  $('#token-length').textContent = `${fullToken.length.toLocaleString('fr-FR')} caractères`;
  $('#token-header').textContent = JSON.stringify(header, null, 2);
  $('#token-payload').textContent = JSON.stringify(payload, null, 2);
}

export function wireTokenPanel() {
  const toggle = $('#token-toggle');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Masquer le jeton brut' : 'Voir le jeton brut';
    $('#token-panel').hidden = !open;
  });
  const copy = $('#token-copy');
  copy.addEventListener('click', async () => {
    if (!fullToken) return;
    const done = (message) => {
      copy.textContent = message;
      setTimeout(() => { copy.textContent = 'Copier le jeton complet'; }, 2200);
    };
    try {
      await navigator.clipboard.writeText(fullToken);
      done(`Copié : ${fullToken.length.toLocaleString('fr-FR')} caractères`);
    } catch {
      $('#token-panel').hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = 'Masquer le jeton brut';
      window.getSelection().selectAllChildren($('#token-jwt'));
      done('Jeton sélectionné : Ctrl+C ou ⌘C');
    }
  });
}
