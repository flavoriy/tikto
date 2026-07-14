import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TaskFilterBarProps = {
  filters: {
    view: string;
    status: string;
    priority: string;
    search: string;
  };
};

export function TaskFilterBar({ filters }: TaskFilterBarProps) {
  return (
    <form className="surface-panel rounded-[14px] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="section-label">Filters</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/tasks"
            className="inline-flex items-center justify-center rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition hover:bg-[var(--panel-muted)] hover:text-foreground"
          >
            Clear
          </a>
          <Button type="submit" variant="primary" size="sm">
            Apply
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">View</label>
          <Select name="view" defaultValue={filters.view}>
            <option value="all">All tasks</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Status</label>
          <Select name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="DONE">DONE</option>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Priority</label>
          <Select name="priority" defaultValue={filters.priority}>
            <option value="">Any priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Search</label>
          <Input name="search" defaultValue={filters.search} placeholder="Search by title or notes" />
        </div>
      </div>
    </form>
  );
}
