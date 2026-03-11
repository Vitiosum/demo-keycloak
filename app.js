const statusEl = document.getElementById('status');
const userEl = document.getElementById('user');
const tokenEl = document.getElementById('token');

function show(message, details) {
  statusEl.textContent = message;
  userEl.textContent = details ? String(details) : 'No details';
  tokenEl.textContent = 'No token';
  console.error(message, details);
}

console.log('APP JS LOADED');
console.log('typeof Keycloak =', typeof Keycloak);

let keycloak = null;

window.doLogin = function () {
  console.log('Login clicked');
  if (!keycloak) {
    show('Keycloak JS library not loaded', 'window.Keycloak is undefined at click time');
    return;
  }
  keycloak.login();
};

window.doLogout = function () {
  console.log('Logout clicked');
  if (!keycloak) {
    show('Keycloak JS library not loaded', 'window.Keycloak is undefined at logout time');
    return;
  }
  keycloak.logout({
    redirectUri: window.location.origin
  });
};

if (typeof Keycloak === 'undefined') {
  show('Keycloak JS library not loaded', 'window.Keycloak is undefined');
} else {
  keycloak = new Keycloak({
    url: 'https://hgft1uiekbtarpkdjsng-keycloak.services.clever-cloud.com',
    realm: 'demo',
    clientId: 'demo-client'
  });

  function render(authenticated) {
    if (!authenticated) {
      statusEl.textContent = 'Not authenticated';
      userEl.textContent = 'No user authenticated';
      tokenEl.textContent = 'No token';
      return;
    }

    const parsed = keycloak.tokenParsed || {};

    statusEl.textContent = 'Authenticated';
    userEl.textContent = JSON.stringify(
      {
        preferred_username: parsed.preferred_username,
        email: parsed.email,
        name: parsed.name,
        issuer: parsed.iss
      },
      null,
      2
    );
    tokenEl.textContent = keycloak.token || 'No token';
  }

  keycloak.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256'
  })
  .then(function (authenticated) {
    render(authenticated);
  })
  .catch(function (err) {
    show('Keycloak init error', err);
  });
}
