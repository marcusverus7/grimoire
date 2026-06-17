import { readFileSync } from 'fs';
import { sign as cryptoSign } from 'crypto';

const KEY_ID = 'V7JYZ8YUDH';
const ISSUER_ID = 'de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4';
const KEY_PATH = 'AuthKey_V7JYZ8YUDH.p8';
const APP_ID = '6781072827';

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

// Invite as Developer (internal tester — no Beta App Review needed)
console.log('Inviting kieranmcparland@hotmail.co.uk as Developer...');
const res = await api('POST', '/userInvitations', {
  data: {
    type: 'userInvitations',
    attributes: {
      email: 'kieranmcparland@hotmail.co.uk',
      firstName: 'Kieran',
      lastName: 'McParland',
      roles: ['DEVELOPER'],
      allAppsVisible: true,
      provisioningAllowed: false
    }
  }
});

console.log('Status:', res.status);
console.log('Body:', JSON.stringify(res.body?.data?.attributes ?? res.body?.errors, null, 2));
