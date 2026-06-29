import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toApiError(error: unknown) {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Validation failed.",
        },
      },
    };
  }

  console.error(error);
  return {
    status: 500,
    body: {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong.",
      },
    },
  };
}
