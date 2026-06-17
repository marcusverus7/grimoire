import { readFileSync } from 'fs';
import { sign as cryptoSign } from 'crypto';

const KEY_ID = 'V7JYZ8YUDH';
const ISSUER_ID = 'de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4';
const KEY_PATH = 'AuthKey_V7JYZ8YUDH.p8';
const APP_ID = '6781072827';
const TESTER_EMAIL = 'kieranmcparland@hotmail.co.uk';

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

// 1. Find the internal group (auto-created by Apple for every app)
console.log('=== Finding internal group ===');
const groups = await api('GET', `/apps/${APP_ID}/betaGroups`);
const allGroups = groups.body?.data ?? [];
console.log('All groups:', allGroups.map(g => ({ id: g.id, name: g.attributes?.name, isInternal: g.attributes?.isInternalGroup })));

const internalGroup = allGroups.find(g => g.attributes?.isInternalGroup);
if (!internalGroup) {
  console.log('No internal group found — will add to external group instead.');
}
const targetGroupId = internalGroup?.id ?? allGroups[0]?.id;
console.log('Target group:', targetGroupId, internalGroup ? '(internal)' : '(external)');

// 2. Create the beta tester
console.log(`\n=== Creating beta tester: ${TESTER_EMAIL} ===`);
const createRes = await api('POST', '/betaTesters', {
  data: {
    type: 'betaTesters',
    attributes: { email: TESTER_EMAIL, firstName: 'Kieran', lastName: 'McParland' },
    relationships: {
      betaGroups: { data: [{ type: 'betaGroups', id: targetGroupId }] }
    }
  }
});
console.log('Create result:', createRes.status);
if (createRes.status === 201) {
  console.log('Tester created:', createRes.body?.data?.id);
  console.log('Email:', createRes.body?.data?.attributes?.email);
} else if (createRes.status === 409) {
  console.log('Tester already exists — fetching and adding to group...');
  // Search for existing tester
  const searchRes = await api('GET', `/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}`);
  console.log('Search:', searchRes.status, JSON.stringify(searchRes.body?.data?.map(t => ({ id: t.id, email: t.attributes?.email })), null, 2));
  if (searchRes.body?.data?.length > 0) {
    const testerId = searchRes.body.data[0].id;
    const addRes = await api('POST', `/betaGroups/${targetGroupId}/relationships/betaTesters`, {
      data: [{ type: 'betaTesters', id: testerId }]
    });
    console.log('Add to group:', addRes.status, addRes.body ? JSON.stringify(addRes.body) : '(no body — success)');
  }
} else {
  console.log('Response:', JSON.stringify(createRes.body, null, 2));
}

// 3. Verify — list testers in the group
console.log('\n=== Testers in group ===');
const testersRes = await api('GET', `/betaGroups/${targetGroupId}/betaTesters`);
console.log('Testers:', JSON.stringify(testersRes.body?.data?.map(t => ({ id: t.id, email: t.attributes?.email, firstName: t.attributes?.firstName })), null, 2));
