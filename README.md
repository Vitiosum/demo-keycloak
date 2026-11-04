# Auth with Keycloak — Keycloak add-on and Static runtime on Clever Cloud

> One static page and no back end: **Login** sends the browser to the sign-in page of the **Keycloak add-on**, and back on the page keycloak-js shows who signed in (username, email, name, issuer) and the start of the access token. The add-on is a managed Keycloak, created in one command with its own Java app, PostgreSQL and FS Bucket; the page is plain HTML and JavaScript served as-is by the **Static runtime**, with no build and no process. On every load the page asks Keycloak whether a session already exists (`check-sso`, PKCE S256) without forcing a sign-in, and **Logout** ends the Keycloak session and comes back to the page.

![The page on Clever Cloud as it loads, before keycloak-js has answered: Login and Logout, status « Initialisation… », empty user fields, no token](docs/screenshot-desktop.png)

<img src="docs/screenshot-phone.png" alt="The same page on a phone, on Clever Cloud, as it loads: buttons stacked, user fields in one column" width="300">

**Run it yourself.** The hosted demo was taken down after the presales review (November 2026). The steps in [Deploy on Clever Cloud](#deploy-on-clever-cloud) recreate it from scratch in about 2 minutes (measured: the page and the add-on answered 106 seconds after the first command), plus about 5 minutes of Keycloak console steps.

## What Keycloak does here

| Where | Keycloak feature | What you see |
|---|---|---|
| Page load | `keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' })`: keycloak-js asks the realm whether a session exists, without showing a form | Status « Initialisation… » (orange), then « Authenticated » (green) or « Not authenticated » (grey) |
| **Login** | `keycloak.login()`: Authorization Code flow with PKCE, realm `demo`, public client `demo-client` | The sign-in page of the realm, served by the add-on, then back to the page |
| User card | `keycloak.tokenParsed`: `preferred_username`, `email`, `name`, `iss` | Username, Email, Name and Issuer (`https://<id>-keycloak.services.clever-cloud.com/realms/demo`) |
| Access Token card | `keycloak.token`, the JWT | Its first 300 characters; **Copy** puts that displayed text on the clipboard, not the full token |
| **Logout** | `keycloak.logout({ redirectUri: window.location.origin })` | Keycloak ends the session and sends the browser back to the page |

If the status turns red, « Keycloak init error », about 10 seconds after loading: the realm `demo` does not exist or `app.js` does not point to your Keycloak. Checked on Clever Cloud with the realm missing: keycloak-js gives up waiting for its third-party cookie check (`Timeout when waiting for 3rd party check iframe message`, in the browser console).

## Deploy on Clever Cloud

You need [clever-tools](https://www.clever.cloud/developers/doc/cli/) (`clever login` done) and the ID of the organisation that will own the resources (`orga_…`, shown in the Console). Run the commands from the repo root: `clever create` links the folder to the new app.

```bash
# 1. The app and its size (Static runtime: nothing is built, no application process)
clever create --type static demo-keycloak --org <org_id> --region par
clever scale --min-flavor nano --max-flavor XS --min-instances 1 --max-instances 2

# 2. Keycloak (plan base, the only one: a Java app, a PostgreSQL and an FS Bucket, created together)
clever addon create keycloak demo-keycloak-sso --plan base --region par --org <org_id> --yes
#    it prints the "Access it" URL, https://<id>-keycloak.services.clever-cloud.com/admin,
#    the admin user name (cc-account-admin) and a temporary password: keep them for the console steps

# 3. Point the page to your Keycloak: the address is written in app.js (a static page reads no variable)
perl -pi -e 's#https://[a-z0-9]+-keycloak\.services\.clever-cloud\.com#https://<id>-keycloak.services.clever-cloud.com#' app.js
git commit -am "Point the demo to my Keycloak"

# 4. Deploy
clever deploy
clever domain    # the page's address, app-<uuid>.cleverapps.io, needed by the client below
```

There is nothing to link and no variable to set: the browser talks to Keycloak directly. Then configure Keycloak in its admin console, an owner step, once:

1. Open the "Access it" URL and sign in with `cc-account-admin` and the temporary password; the add-on says you will be asked to change it at the first login.
2. Create a realm named `demo`. The add-on already holds a realm `example`, unused here.
3. In `demo`, **Clients › Create client**: client ID `demo-client`, OpenID Connect; **Client authentication** off (a public client: a browser page cannot keep a secret), **Standard flow** on; **Valid redirect URIs** `https://<app-domain>/*`, **Valid post logout redirect URIs** `+`, **Web origins** `+`.
4. **Users › Create new user** with a username, an email, a first and a last name (they fill the User card), then **Credentials › Set password**, **Temporary** off.
5. Open the page, click **Login** and sign in with that user.

Use the console for these steps: the add-on refuses the password grant of the `admin-cli` client (`invalid_client`), which `kcadm.sh` uses, so the initial account cannot drive the admin REST API from a terminal.

The add-on starts at about €47 per 30 days (provider listing). After the demo, `clever addon delete <addon_id> --org <org_id> --yes` removes it with its Java app, PostgreSQL and FS Bucket (checked on Clever Cloud), and `clever delete --yes` removes the page.

## Variables

The page reads no environment variable: its Keycloak settings are written in `app.js`.

| Setting in `app.js` | Value |
|---|---|
| `url` | your add-on, `https://<id>-keycloak.services.clever-cloud.com` (step 3) |
| `realm` | `demo` |
| `clientId` | `demo-client` |

The add-on keeps its own settings on its Java app, visible in the Console:

| Variable | Set by | Role |
|---|---|---|
| `CC_KEYCLOAK_ADMIN` | Keycloak add-on | `cc-account-admin`, the initial admin |
| `CC_KEYCLOAK_ADMIN_DEFAULT_PASSWORD` | Keycloak add-on | The temporary password printed at creation |
| `CC_KEYCLOAK_REALMS` | Keycloak add-on | `example` at creation. The docs: a comma-separated list of realms, applied after a restart of the Java app |
| `CC_KEYCLOAK_VERSION` | Keycloak add-on | `26.7.4` when tested (November 2026) |

## Routes

The Static runtime serves the repo root as-is: `/` the page (`index.html`) · `/app.js` · `/config.js` and `/keycloak.min.js`, served but not used. On the add-on: `/admin` the admin console · `/realms/demo/…` the OpenID Connect endpoints of the realm.

## Code tour

```
index.html        the page: styles, cards, certification banner, footer; render hooks (__setAuthenticated,
                  __setUnauthenticated, __setError) and the Copy button; loads keycloak-js 22.0.5 from unpkg, then app.js
app.js            keycloak-js set-up: Keycloak URL, realm demo, client demo-client; init check-sso with PKCE; Login, Logout
config.js         window.KEYCLOAK_CONFIG with an older Keycloak URL: not loaded by index.html
keycloak.min.js   a copy of the keycloak-js adapter (not minified): not loaded either, index.html uses unpkg
```

No framework, no package, nothing to build.

## Run locally

```bash
python3 -m http.server 8301    # any static server
```

Then add `http://localhost:8301/*` to the client's valid redirect URIs (web origins `+` follows), and open http://localhost:8301.

MIT License.
