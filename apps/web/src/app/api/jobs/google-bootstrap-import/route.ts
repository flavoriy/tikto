import { NextResponse } from "next/server";

const body = {
  success: false,
  error: {
    code: "FEATURE_DISABLED",
    message: "This optional integration feature is disabled in the focused microservice build.",
  },
};

export function POST() {
  return NextResponse.json(body, { status: 404 });
}