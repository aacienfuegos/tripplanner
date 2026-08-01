import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";

// Cifrado de campos sensibles en reposo (documentos de identidad, referencias
// de reserva, notas libres): la DB SQLite en sí no está cifrada (expo-sqlite
// soporta SQLCipher pero exige salir de Expo Go — ver issue de seguimiento),
// así que un backup extraído fuera del sandbox de la app (adb backup con USB
// debugging, o un dispositivo rooteado) expondría esos campos en claro. Las
// claves viven en el Android Keystore vía expo-secure-store, no en la propia
// DB (#182). Una única clave se comparte entre todas las tablas que usan
// este módulo.
const ENC_KEY_STORE_KEY = "field_enc_key_v1";
const MAC_KEY_STORE_KEY = "field_mac_key_v1";
const KEY_BYTE_LENGTH = 32;
const IV_BYTE_LENGTH = 16;

function uint8ArrayToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

async function getOrCreateKey(storeKey: string): Promise<CryptoJS.lib.WordArray> {
  const existing = await SecureStore.getItemAsync(storeKey);
  if (existing) return CryptoJS.enc.Base64.parse(existing);

  const bytes = await Crypto.getRandomBytesAsync(KEY_BYTE_LENGTH);
  const key = uint8ArrayToWordArray(bytes);
  await SecureStore.setItemAsync(storeKey, key.toString(CryptoJS.enc.Base64));
  return key;
}

function hmac(ivB64: string, ciphertextB64: string, macKey: CryptoJS.lib.WordArray): string {
  return CryptoJS.HmacSHA256(`${ivB64}:${ciphertextB64}`, macKey).toString(CryptoJS.enc.Base64);
}

const ENCRYPTED_FORMAT = /^v1:[^:]+:[^:]+:[^:]+$/;

// Encrypt-then-MAC: CBC no autentica por sí solo, así que un HMAC separado
// (con su propia clave) detecta si el ciphertext fue modificado en la DB.
export async function encryptText(plaintext: string): Promise<string> {
  const [encKey, macKey] = await Promise.all([
    getOrCreateKey(ENC_KEY_STORE_KEY),
    getOrCreateKey(MAC_KEY_STORE_KEY),
  ]);

  const ivBytes = await Crypto.getRandomBytesAsync(IV_BYTE_LENGTH);
  const iv = uint8ArrayToWordArray(ivBytes);

  const cipher = CryptoJS.AES.encrypt(plaintext, encKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const ivB64 = iv.toString(CryptoJS.enc.Base64);
  const ciphertextB64 = cipher.ciphertext.toString(CryptoJS.enc.Base64);
  const mac = hmac(ivB64, ciphertextB64, macKey);

  return `v1:${ivB64}:${ciphertextB64}:${mac}`;
}

// Datos ya en la DB antes de este fix quedan en claro (no había nada que
// migrar sin la clave): si el valor no tiene el formato "v1:...", se
// devuelve tal cual en vez de fallar.
export async function decryptText(stored: string): Promise<string> {
  if (!ENCRYPTED_FORMAT.test(stored)) return stored;

  const [, ivB64, ciphertextB64, mac] = stored.split(":");
  const [encKey, macKey] = await Promise.all([
    getOrCreateKey(ENC_KEY_STORE_KEY),
    getOrCreateKey(MAC_KEY_STORE_KEY),
  ]);

  if (hmac(ivB64, ciphertextB64, macKey) !== mac) {
    throw new Error("Field integrity check failed: ciphertext or MAC mismatch");
  }

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(ciphertextB64) } as CryptoJS.lib.CipherParams,
    encKey,
    { iv: CryptoJS.enc.Base64.parse(ivB64), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  );
  return decrypted.toString(CryptoJS.enc.Utf8);
}
