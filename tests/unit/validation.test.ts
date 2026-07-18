import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  sanitizeName,
  validateDisplayName,
} from "@/lib/validation";

describe("display names", () => {
  it("accepts normal names", () => {
    expect(validateDisplayName("Grace")).toEqual({ ok: true, name: "Grace" });
    expect(validateDisplayName("John 3.16")).toEqual({ ok: true, name: "John 3.16" });
    expect(validateDisplayName("Mary-Anne O'Neil")).toEqual({ ok: true, name: "Mary-Anne O'Neil" });
  });

  it("rejects too-short and too-long names", () => {
    expect(validateDisplayName("a").ok).toBe(false);
    expect(validateDisplayName("x".repeat(30)).ok).toBe(false);
  });

  it("rejects names with unsupported characters", () => {
    expect(validateDisplayName("<script>alert(1)</script>").ok).toBe(false);
    expect(validateDisplayName("bad;name{}").ok).toBe(false);
  });

  it("sanitizes by stripping dangerous characters and collapsing spaces", () => {
    expect(sanitizeName("  A   B<>{}  ")).toBe("A B");
    expect(sanitizeName("x".repeat(40)).length).toBeLessThanOrEqual(20);
  });
});

describe("room codes", () => {
  it("generates codes of the right length and alphabet", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it("rejects empty, short, and invalid codes", () => {
    expect(isValidRoomCode("")).toBe(false);
    expect(isValidRoomCode("AB")).toBe(false);
    expect(isValidRoomCode("ABC1O")).toBe(false); // O not in alphabet
    expect(isValidRoomCode("abcde")).toBe(false); // lowercase pre-normalization
  });

  it("normalizes user input (lowercase, spaces, punctuation)", () => {
    expect(normalizeRoomCode(" k7-m3 p ")).toBe("K7M3P");
    expect(normalizeRoomCode("toolongcode")).toHaveLength(ROOM_CODE_LENGTH);
  });
});
