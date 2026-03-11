const keycloak = new Keycloak(window.KEYCLOAK_CONFIG);

const statusEl = document.getElementById('status');
const userEl = document.getElementById('user');
const tokenEl = document.getElementById('token');

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

window.refreshToken = function () {
  keycloak
    .updateToken(30)
    .then(function (refreshed) {
      if (refreshed) {
        console.log('Token refreshed');
      } else {
        console.log('Token still valid');
      }
      render(keycloak.authenticated);
    })
    .catch(function () {
      console.error('Failed to refresh token');
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
    statusEl.textContent = 'Keycloak init error';
    userEl.textContent = String(err);
  });
