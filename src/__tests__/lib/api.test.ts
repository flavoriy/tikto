import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fail, handleApiError, invariant, ok } from "@/lib/api";
import { AppError } from "@/lib/errors";

describe("ok", () => {
  it("returns 200 response with success body", async () => {
    const res = ok({ id: 1 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: 1 } });
  });

  it("forwards custom ResponseInit", async () => {
    const res = ok({}, { status: 201 });
    expect(res.status).toBe(201);
  });

  it("works with null data", async () => {
    const body = await ok(null).json();
    expect(body).toEqual({ success: true, data: null });
  });
});

describe("fail", () => {
  it("returns correct status and error body", async () => {
    const res = fail(404, "NOT_FOUND", "Not found.");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Not found." } });
  });

  it("works with 500", async () => {
    const res = fail(500, "INTERNAL", "Server error.");
    expect(res.status).toBe(500);
  });
});

describe("handleApiError", () => {
  it("handles AppError correctly", async () => {
    const res = handleApiError(new AppError(403, "FORBIDDEN", "Forbidden."));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: { code: "FORBIDDEN", message: "Forbidden." } });
  });

  it("handles ZodError with first issue message", async () => {
    let zodError: z.ZodError;
    try {
      z.string().min(1).parse("");
    } catch (err) {
      zodError = err as z.ZodError;
    }
    const res = handleApiError(zodError!);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 500 for unknown errors", async () => {
    const res = handleApiError(new Error("unexpected"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("returns 500 for non-Error thrown values", async () => {
    const res = handleApiError("string error");
    expect(res.status).toBe(500);
  });
});

describe("invariant", () => {
  it("does not throw when condition is truthy", () => {
    expect(() => invariant(true, 400, "X", "x")).not.toThrow();
    expect(() => invariant(1, 400, "X", "x")).not.toThrow();
    expect(() => invariant("value", 400, "X", "x")).not.toThrow();
  });

  it("throws AppError when condition is falsy", () => {
    expect(() => invariant(false, 422, "INVALID", "Invalid.")).toThrow(AppError);
    expect(() => invariant(null, 422, "INVALID", "Invalid.")).toThrow(AppError);
    expect(() => invariant(0, 422, "INVALID", "Invalid.")).toThrow(AppError);
  });

  it("throws AppError with correct properties", () => {
    try {
      invariant(false, 400, "BAD_INPUT", "Bad input.");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(400);
      expect((err as AppError).code).toBe("BAD_INPUT");
      expect((err as AppError).message).toBe("Bad input.");
    }
  });
});
