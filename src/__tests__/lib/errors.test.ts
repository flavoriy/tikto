import { describe, expect, it } from "vitest";

import { AppError, isAppError } from "@/lib/errors";

describe("AppError", () => {
  it("stores status, code, and message", () => {
    const err = new AppError(404, "NOT_FOUND", "Resource not found.");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Resource not found.");
  });

  it("is an instance of Error", () => {
    expect(new AppError(500, "ERR", "oops")).toBeInstanceOf(Error);
  });

  it("has name 'AppError'", () => {
    expect(new AppError(400, "BAD", "bad")).toHaveProperty("name", "AppError");
  });
});

describe("isAppError", () => {
  it("returns true for AppError instances", () => {
    expect(isAppError(new AppError(400, "X", "x"))).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isAppError("string")).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(42)).toBe(false);
  });
});
