import { readFileSync } from 'fs';
import { sign as cryptoSign } from 'crypto';

const KEY_ID = 'V7JYZ8YUDH';
const ISSUER_ID = 'de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4';
const KEY_PATH = 'AuthKey_V7JYZ8YUDH.p8';
const APP_ID = '6781072827';
const TESTER_EMAIL = 'kieranmcparland@hotmail.co.uk';
const EXTERNAL_GROUP_ID = '23a7b8f8-da7f-4db9-9b1c-5dd93c5c3294';

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

// 1. Verify external group still exists
const grp = await api('GET', `/betaGroups/${EXTERNAL_GROUP_ID}`);
console.log('External group GET:', grp.status, JSON.stringify({
  name: grp.body?.data?.attributes?.name,
  isInternal: grp.body?.data?.attributes?.isInternalGroup,
  publicLinkEnabled: grp.body?.data?.attributes?.publicLinkEnabled,
  publicLink: grp.body?.data?.attributes?.publicLink,
  error: grp.body?.errors?.[0]?.detail
}, null, 2));

// 2. Try creating the tester directly linked to the external group
console.log('\n=== Creating tester linked to external group ===');
const createRes = await api('POST', '/betaTesters', {
  data: {
    type: 'betaTesters',
    attributes: { email: TESTER_EMAIL, firstName: 'Kieran', lastName: 'McParland' },
    relationships: {
      betaGroups: { data: [{ type: 'betaGroups', id: EXTERNAL_GROUP_ID }] }
    }
  }
});
console.log('Create status:', createRes.status);
console.log('Body:', JSON.stringify(createRes.body?.data?.attributes ?? createRes.body?.errors, null, 2));

// 3. If 409, find tester ID and add to group directly
if (createRes.status === 409) {
  console.log('\nTester exists — searching by email...');
  const search = await api('GET', `/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}&filter[apps]=${APP_ID}`);
  console.log('Search (app-scoped):', search.status, JSON.stringify(search.body?.data?.map(t => ({ id: t.id, email: t.attributes?.email })), null, 2));

  // Try without app filter
  const search2 = await api('GET', `/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}`);
  console.log('Search (global):', search2.status, JSON.stringify(search2.body?.data?.map(t => ({ id: t.id, email: t.attributes?.email })), null, 2));

  const testerId = search2.body?.data?.[0]?.id ?? search.body?.data?.[0]?.id;
  if (testerId) {
    console.log(`\nFound tester ${testerId} — adding to external group...`);
    const addRes = await api('POST', `/betaGroups/${EXTERNAL_GROUP_ID}/relationships/betaTesters`, {
      data: [{ type: 'betaTesters', id: testerId }]
    });
    console.log('Add to group:', addRes.status, addRes.body ? JSON.stringify(addRes.body) : '(204 no body = success)');
  }
}

// 4. List testers in external group
const testers = await api('GET', `/betaGroups/${EXTERNAL_GROUP_ID}/betaTesters`);
console.log('\nTesters in external group:', testers.status, JSON.stringify(
  testers.body?.data?.map(t => ({ email: t.attributes?.email, name: `${t.attributes?.firstName} ${t.attributes?.lastName}`, state: t.attributes?.betaInviteType })),
  null, 2
));
