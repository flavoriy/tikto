import { fail } from "@/lib/api";

export async function POST() {
  return fail(501, "NOT_IMPLEMENTED", "Calendar watch renewal is not implemented yet.");
}
