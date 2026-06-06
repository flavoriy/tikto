import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { serializeTask } from "@/lib/serializers";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { TaskBoard } from "@/components/tasks/task-board";
import { listTasksForView } from "@/server/services/task.service";

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
  const { filters, tasks } = await listTasksForView({
    userId: profile.id,
    timezone: profile.timezone,
    query,
  });

  return (
    <>
      <TaskFilterBar filters={filters} />
      <TaskBoard tasks={tasks.map(serializeTask)} timezone={profile.timezone} />
    </>
  );
}
