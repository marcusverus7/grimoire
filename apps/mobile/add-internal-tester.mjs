import { readFileSync } from 'fs';
import { sign as cryptoSign } from 'crypto';

const KEY_ID = 'V7JYZ8YUDH';
const ISSUER_ID = 'de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4';
const KEY_PATH = 'AuthKey_V7JYZ8YUDH.p8';
const APP_ID = '6781072827';
const TESTER_EMAIL = 'kieranmcp1990@icloud.com';

function generateJWT() {
  const privateKey = readFileSync(KEY_PATH, 'utf8');
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const data = `${header}.${payload}`;
  const sig = cryptoSign('sha256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}

async function api(method, path, body) {
  const token = generateJWT();
  const resp = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await resp.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: resp.status, body: parsed };
}

// 1. Find internal beta group
const groups = await api('GET', `/apps/${APP_ID}/betaGroups`);
const allGroups = groups.body?.data ?? [];
console.log('Groups:', allGroups.map(g => ({ id: g.id, name: g.attributes?.name, isInternal: g.attributes?.isInternalGroup })));

const internalGroup = allGroups.find(g => g.attributes?.isInternalGroup);
console.log('Internal group:', internalGroup?.id, internalGroup?.attributes?.name);

if (!internalGroup) { console.error('No internal group found'); process.exit(1); }

// 2. Add tester to internal group (creates if needed)
const createRes = await api('POST', '/betaTesters', {
  data: {
    type: 'betaTesters',
    attributes: { email: TESTER_EMAIL, firstName: 'Kieran', lastName: 'McParland' },
    relationships: {
      betaGroups: { data: [{ type: 'betaGroups', id: internalGroup.id }] }
    }
  }
});
console.log('Create tester status:', createRes.status);

if (createRes.status === 409) {
  console.log('Tester exists — finding and adding to internal group...');
  const search = await api('GET', `/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}`);
  const testerId = search.body?.data?.[0]?.id;
  console.log('Found tester ID:', testerId);
  if (testerId) {
    const add = await api('POST', `/betaGroups/${internalGroup.id}/relationships/betaTesters`, {
      data: [{ type: 'betaTesters', id: testerId }]
    });
    console.log('Add to group:', add.status, add.status === 204 ? 'SUCCESS' : JSON.stringify(add.body));
  }
} else if (createRes.status === 201) {
  console.log('Tester created and added to internal group — TestFlight invite sent!');
} else {
  console.log('Response:', JSON.stringify(createRes.body, null, 2));
}
