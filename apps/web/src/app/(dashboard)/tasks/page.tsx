import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { TaskBoard } from "@/components/tasks/task-board";
import { getTasksForView } from "@/lib/internal-services/client";

type TasksPageProps = {
  searchParams: Promise<{
    view?: string;
    status?: string;
    priority?: string;
    search?: string;
  }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const profile = await getCurrentProfileOrRedirect();
  const query = await searchParams;
  const { filters, tasks } = await getTasksForView(query);

  return (
    <>
      <TaskFilterBar filters={filters} />
      <TaskBoard tasks={tasks} timezone={profile.timezone} />
    </>
  );
}