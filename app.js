const keycloak = new Keycloak({
  url: 'https://pgck8uiz7fmuukimpoxj-keycloak.services.clever-cloud.com',
  realm: 'demo',
  clientId: 'demo-client'
});

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
  userEl.textContent = JSON.stringify({
    preferred_username: parsed.preferred_username,
    email: parsed.email,
    name: parsed.name,
    realm: parsed.iss
  }, null, 2);

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

keycloak.init({
  pkceMethod: 'S256'
}).then(function (authenticated) {
  render(authenticated);
}).catch(function (err) {
  statusEl.textContent = 'Keycloak init error';
  userEl.textContent = String(err);
});
