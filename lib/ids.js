import { randomBytes, randomUUID } from "node:crypto";

/** Short, URL-safe, unguessable token (crypto-random, base32-ish alphabet). */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // no i/l/o/u, avoids look-alikes

export function token(length = 22) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function id() {
  return randomUUID();
}
