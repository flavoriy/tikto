import { handleApiError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    return ok({ signedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
