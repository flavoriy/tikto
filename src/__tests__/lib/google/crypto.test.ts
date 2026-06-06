import { describe, expect, it } from "vitest";

import { decrypt, encrypt } from "@/lib/google/crypto";

describe("encrypt / decrypt", () => {
  it("roundtrip: decrypt(encrypt(x)) === x", () => {
    const plaintext = "my-secret-token";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("works with empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("works with long strings", () => {
    const long = "a".repeat(2000);
    expect(decrypt(encrypt(long))).toBe(long);
  });

  it("works with special characters", () => {
    const special = 'ya29.A0ARrdaM-"special"&token=<value>';
    expect(decrypt(encrypt(special))).toBe(special);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "same-plaintext";
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);
    expect(first).not.toBe(second);
  });

  it("encrypted format contains three colon-separated segments", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("decrypt throws on malformed input", () => {
    expect(() => decrypt("not-valid")).toThrow();
    expect(() => decrypt("a:b")).toThrow();
  });

  it("decrypt throws when auth tag is corrupted", () => {
    const encrypted = encrypt("hello");
    const parts = encrypted.split(":");
    const corrupted = `${parts[0]}:AAAA:${parts[2]}`;
    expect(() => decrypt(corrupted)).toThrow();
  });
});
