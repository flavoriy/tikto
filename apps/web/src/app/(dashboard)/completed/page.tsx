import { redirect } from "next/navigation";

export default function CompletedPage() {
  redirect("/tasks?view=completed");
}
