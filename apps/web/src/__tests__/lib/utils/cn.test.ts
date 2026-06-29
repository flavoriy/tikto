import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false, undefined, null, "bar")).toBe("foo bar");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles conditional class objects", () => {
    expect(cn({ "text-red-500": true, "text-green-500": false })).toBe("text-red-500");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });
});
