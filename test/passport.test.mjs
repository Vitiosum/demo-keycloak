// node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkDigit, decodeSegment, mrz, mrzText, realmOf, rolesOf, specimen, splitJwt, timeLeft, toPassport,
} from '../passport.js';

const REALM_URL = 'https://your-addon-id-keycloak.services.clever-cloud.com/realms/demo';

test('check digits match the ICAO 9303 specimen passport', () => {
  // L898902C36UTO7408122F1204159ZE184226B<<<<<10
  assert.equal(checkDigit('L898902C3'), '6');
  assert.equal(checkDigit('740812'), '2');
  assert.equal(checkDigit('120415'), '9');
  assert.equal(checkDigit('ZE184226B<<<<<'), '1');
  assert.equal(checkDigit('L898902C36' + '7408122' + '1204159' + 'ZE184226B<<<<<1'), '0');
});

test('names are written in the MRZ alphabet', () => {
  assert.equal(mrzText('Éloïse-Anne', 12), 'ELOISE<ANNE<');
  const [line1] = mrz({ realm: 'UTO', surname: 'Eriksson', givenNames: 'Anna María', sub: '', exp: 0, username: '' });
  assert.equal(line1, 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<');
});

test('both MRZ lines are 44 characters, from the token claims', () => {
  const { claims } = specimen(REALM_URL);
  const [line1, line2] = toPassport(claims).mrz;
  assert.equal(line1.length, 44);
  assert.equal(line2.length, 44);
  assert.match(line1, /^P<DEMVOYAGEUR<<CAMILLE</);
  assert.match(line2, /^000000000/);                         // passport number = sub
  assert.equal(line2.slice(10, 13), 'DEM');                   // realm code
  assert.equal(line2.slice(21, 27), '260101');                // exp, YYMMDD
  assert.equal(line2.slice(28, 42), 'CAMILLE<VOYAGE');       // preferred_username, 14 characters
});

test('the passport maps each claim to its field', () => {
  const { claims, header } = specimen(REALM_URL);
  const p = toPassport(claims, header);
  assert.equal(p.realm, 'demo');
  assert.equal(p.code, 'DEM');
  assert.equal(p.surname, 'Voyageur');
  assert.equal(p.givenNames, 'Camille');
  assert.equal(p.iss, REALM_URL);
  assert.equal(p.client, 'demo-client');
  assert.equal(p.alg, 'RS256');
  assert.equal(p.roles.length, 6);
  assert.deepEqual(p.roles[3], { name: 'manage-account', from: 'account' });
});

test('a token without names falls back to the username', () => {
  const p = toPassport({ preferred_username: 'alice', iss: REALM_URL, sub: 'abc' });
  assert.equal(p.surname, 'alice');
  assert.equal(p.givenNames, '');
  assert.deepEqual(rolesOf({}), []);
});

test('JWT segments are split and decoded, UTF-8 included', () => {
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${encode({ alg: 'RS256' })}.${encode({ name: 'Zoé' })}.c2ln`;
  const parts = splitJwt(token);
  assert.deepEqual(decodeSegment(parts.header), { alg: 'RS256' });
  assert.deepEqual(decodeSegment(parts.payload), { name: 'Zoé' });
  assert.equal(parts.signature, 'c2ln');
  assert.equal(decodeSegment('not json'), null);
});

test('realm and validity helpers', () => {
  assert.equal(realmOf(REALM_URL), 'demo');
  assert.equal(realmOf('https://example.test'), '');
  assert.equal(timeLeft(1000, 753), '4 min 07 s');
  assert.equal(timeLeft(1000, 1000), null);
});
