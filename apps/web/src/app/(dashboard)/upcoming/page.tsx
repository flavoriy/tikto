import { redirect } from "next/navigation";

export default function UpcomingPage() {
  redirect("/tasks?view=upcoming");
}
