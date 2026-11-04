// The only setting to change: the address of YOUR Keycloak add-on,
// printed by `clever addon create keycloak …` ("Access it" URL, without /admin).
// The realm and the client are the ones created in the Keycloak console (README).
window.KEYCLOAK_CONFIG = {
  url: 'https://your-addon-id-keycloak.services.clever-cloud.com',
  realm: 'demo',
  clientId: 'demo-client',
};
