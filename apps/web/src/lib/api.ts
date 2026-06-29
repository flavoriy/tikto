import { ZodError } from "zod";

import { AppError, isAppError } from "@/lib/errors";

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data } satisfies ApiSuccess<T>, init);
}

export function fail(status: number, code: string, message: string) {
  return Response.json(
    {
      success: false,
      error: { code, message },
    } satisfies ApiFailure,
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (isAppError(error)) {
    return fail(error.status, error.code, error.message);
  }

  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Validation failed.";
    return fail(400, "VALIDATION_ERROR", message);
  }

  console.error(error);
  return fail(500, "INTERNAL_SERVER_ERROR", "Something went wrong.");
}

export function invariant(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) {
    throw new AppError(status, code, message);
  }
}
