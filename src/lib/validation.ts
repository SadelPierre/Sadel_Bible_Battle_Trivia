import { z } from "zod";

export const MAX_NAME_LENGTH = 20;

/** Letters, numbers, spaces, and a few friendly punctuation marks. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer`)
  .regex(/^[\p{L}\p{N} .,'_-]+$/u, "Name contains unsupported characters");

/** Sanitize a display name for storage/rendering. Never trust client input. */
export function sanitizeName(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} .,'_-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function validateDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const parsed = displayNameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  return { ok: true, name: sanitizeName(parsed.data) };
}

/** Room codes: 5 chars from an unambiguous alphabet (no O/0, I/1, etc.) */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
  );
}

export const questionCountSchema = z.number().int().min(1).max(30);
