import { readFileSync } from 'fs';
import * as identity from '@dfinity/identity';

const pem = readFileSync('/Users/hal1/.config/dfx/identity/staging/identity.pem', 'utf8');

console.log('Testing PEM identity...\n');
console.log('PEM preview:', pem.substring(0, 50) + '...\n');
console.log('Available methods:', Object.keys(identity));
console.log('');

// Check available methods on each identity class
console.log('Secp256k1KeyIdentity static methods:', Object.getOwnPropertyNames(identity.Secp256k1KeyIdentity));
console.log('Ed25519KeyIdentity static methods:', Object.getOwnPropertyNames(identity.Ed25519KeyIdentity));
console.log('ECDSAKeyIdentity static methods:', Object.getOwnPropertyNames(identity.ECDSAKeyIdentity));
console.log('');

// Try different identity types
const identityTypes = [
  { name: 'Secp256k1KeyIdentity', class: identity.Secp256k1KeyIdentity },
  { name: 'Ed25519KeyIdentity', class: identity.Ed25519KeyIdentity },
  { name: 'ECDSAKeyIdentity', class: identity.ECDSAKeyIdentity }
];

for (const { name, class: IdentityClass } of identityTypes) {
  try {
    console.log(`Trying ${name}.fromPem...`);
    if (typeof IdentityClass.fromPem === 'function') {
      const id = IdentityClass.fromPem(pem);
      const principal = id.getPrincipal().toText();
      console.log(`✅ ${name} Principal:`, principal);
    } else {
      console.log(`❌ ${name}.fromPem is not a function`);
    }
  } catch (e) {
    console.log(`❌ ${name} failed:`, e.message);
  }
}

console.log('\nExpected principal (from dfx):');
console.log('le4c3-erfdl-t3jek-qbayb-hawea-ezs4s-5jhzs-h4das-7q6hp-ep6ji-7ae');
