const statusEl = document.getElementById('status');
const userEl = document.getElementById('user');
const tokenEl = document.getElementById('token');

function showError(message, error) {
  statusEl.textContent = message;
  userEl.textContent = error ? String(error) : 'No details';
  tokenEl.textContent = 'No token';
  console.error(message, error);
}

if (typeof Keycloak === 'undefined') {
  showError('Keycloak JS library not loaded', 'window.Keycloak is undefined');
} else {
  const keycloak = new Keycloak({
    url: 'https://mqhn397xci4ekoj1jzvs-keycloak.services.clever-cloud.com',
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

  window.doLogin = function () {
    keycloak.login();
  };

  window.doLogout = function () {
    keycloak.logout({
      redirectUri: window.location.origin
    });
  };

  keycloak
    .init({
      onLoad: 'check-sso',
      pkceMethod: 'S256'
    })
    .then(function (authenticated) {
      render(authenticated);
    })
    .catch(function (err) {
      showError('Keycloak init error', err);
    });
}
