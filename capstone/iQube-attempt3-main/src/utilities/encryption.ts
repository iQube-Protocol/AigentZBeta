/** AES-256-GCM via Web Crypto API (browser-native, authenticated encryption) */
const IV_LENGTH = 12;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

class EncryptionModule {
  static Encrypt = async (data: unknown) => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      encoded
    );

    const rawKey = await crypto.subtle.exportKey("raw", key);
    const keyHex = bytesToHex(new Uint8Array(rawKey));
    const ciphertextBytes = new Uint8Array(ciphertext);
    const authTag = ciphertextBytes.slice(-16);
    const encryptedBody = ciphertextBytes.slice(0, -16);

    return {
      iv: bytesToHex(iv),
      authTag: bytesToHex(authTag),
      encryptedData: bytesToHex(encryptedBody),
      key: keyHex,
    };
  };

  static Decrypt = async (encrypted: {
    iv: string;
    authTag: string;
    encryptedData: string;
    key: string;
  }) => {
    const keyBytes = hexToBytes(encrypted.key);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const iv = hexToBytes(encrypted.iv);
    const encryptedBody = hexToBytes(encrypted.encryptedData);
    const authTag = hexToBytes(encrypted.authTag);
    const ciphertext = new Uint8Array(encryptedBody.length + authTag.length);
    ciphertext.set(encryptedBody);
    ciphertext.set(authTag, encryptedBody.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      ciphertext
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  };
}

export default EncryptionModule;
