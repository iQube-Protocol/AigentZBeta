import nacl from 'tweetnacl';
import { base58btc } from 'multiformats/bases/base58';

const kp = nacl.sign.keyPair();
const pub = kp.publicKey;
const sec = kp.secretKey; // 64 bytes: 32-byte seed + 32-byte public key

// did:key fingerprint for Ed25519: multicodec 0xed01 + pubkey, base58btc
const prefix = new Uint8Array([0xed, 0x01]);
const mb = new Uint8Array(prefix.length + pub.length);
mb.set(prefix, 0);
mb.set(pub, prefix.length);
const fingerprint = 'z' + base58btc.encode(mb).slice(1);
const did = 'did:key:' + fingerprint;

const publicKeyBase58 = base58btc.encode(pub).slice(1);
const secretKeyBase58 = base58btc.encode(sec).slice(1);
const seed = sec.slice(0, 32);
const seedBase58 = base58btc.encode(seed).slice(1);

const doc = {
  did,
  publicKeyBase58,
  secretKeyBase58,
  seedBase58,
};

console.log(JSON.stringify(doc, null, 2));
