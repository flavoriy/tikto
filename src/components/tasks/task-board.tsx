"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  TimerReset,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getTaskBoardCounts,
  getTaskDueMeta,
  groupTasksByStatus,
  type TaskBoardRecord,
} from "@/lib/tasks/task-board";
import { cn } from "@/lib/utils/cn";

type TaskFormState = {
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string;
  dueTime: string;
};

const emptyTask: TaskFormState = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
  dueTime: "",
};

const columns = [
  {
    key: "TODO",
    title: "To do",
    description: "Clear next actions waiting to be picked up.",
    icon: Clock3,
    panelClass: "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]",
    iconClass: "bg-white text-[#c2410c]",
  },
  {
    key: "IN_PROGRESS",
    title: "In progress",
    description: "Work already moving and worth protecting.",
    icon: TimerReset,
    panelClass: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    iconClass: "bg-white text-[#1d4ed8]",
  },
  {
    key: "DONE",
    title: "Done",
    description: "Completed items that are safely out of the way.",
    icon: CheckCircle2,
    panelClass: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    iconClass: "bg-white text-[#166534]",
  },
] as const;

const summaryCards = [
  {
    key: "todo",
    label: "To do",
    hint: "Need a clear next move",
    className: "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]",
  },
  {
    key: "inProgress",
    label: "In progress",
    hint: "Already on the go",
    className: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
  },
  {
    key: "overdue",
    label: "Overdue",
    hint: "Need attention first",
    className: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  },
  {
    key: "done",
    label: "Done",
    hint: "Closed in this view",
    className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
  },
] as const;

function taskToForm(task: TaskBoardRecord): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    dueTime: task.dueTime ?? "",
  };
}

function getPriorityMeta(priority: TaskBoardRecord["priority"]) {
  if (priority === "HIGH") {
    return {
      label: "High priority",
      className: "bg-[#fee2e2] text-[#b91c1c]",
    };
  }

  if (priority === "MEDIUM") {
    return {
      label: "Medium priority",
      className: "bg-[#ffedd5] text-[#c2410c]",
    };
  }

  return {
    label: "Low priority",
    className: "bg-[#dbeafe] text-[#1d4ed8]",
  };
}

export function TaskBoard({ tasks, timezone }: { tasks: TaskBoardRecord[]; timezone: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<TaskBoardRecord | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyTask);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);
  const counts = getTaskBoardCounts(tasks, timezone);
  const groupedTasks = groupTasksByStatus(tasks);

  function openCreateModal() {
    setEditing(null);
    setForm(emptyTask);
    setError(null);
    setActionError(null);
    setIsOpen(true);
  }

  function openEditModal(task: TaskBoardRecord) {
    setEditing(task);
    setForm(taskToForm(task));
    setError(null);
    setActionError(null);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setEditing(null);
    setError(null);
    setActionError(null);
    setForm(emptyTask);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setActionError(null);

    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate,
      dueTime: form.dueTime,
    };

    startTransition(async () => {
      const response = await fetch(editing ? `/api/tasks/${editing.id}` : "/api/tasks", {
        method: editing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? "Could not save task.");
        return;
      }

      closeModal();
      router.refresh();
    });
  }

  function mutate(url: string, method: string) {
    startTransition(async () => {
      setActionError(null);
      const response = await fetch(url, { method });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setActionError(result?.error?.message ?? "Could not update task.");
        return;
      }

      router.refresh();
    });
  }

  function completeTask(id: string) {
    startTransition(async () => {
      setActionError(null);
      setCompletingTaskId(id);

      const response = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setActionError(result?.error?.message ?? "Could not complete task.");
        setCompletingTaskId(null);
        return;
      }

      setCompletingTaskId(null);
      setCompletedTaskId(id);
      window.setTimeout(() => {
        router.refresh();
        setCompletedTaskId(null);
      }, 520);
    });
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-label">Tasks</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Task board</h2>
            <p className="mt-1 text-sm text-muted">
              A clearer view of what is next, what is moving, and what is already done.
            </p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="size-4" />
            New task
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.key} className={cn("rounded-[18px] border px-4 py-4", card.className)}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">{card.label}</p>
              <p className="mt-2 text-[2rem] font-bold leading-none tracking-[-0.05em]">{counts[card.key]}</p>
              <p className="mt-2 text-xs opacity-80">{card.hint}</p>
            </div>
          ))}
        </div>

        {actionError ? (
          <div className="mt-5 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        {tasks.length === 0 ? (
          <div className="panel-muted mt-5 rounded-[16px] border-dashed px-5 py-10 text-center text-sm text-muted">
            <p>No tasks match the current filters yet.</p>
            <div className="mt-4">
              <Button variant="secondary" onClick={openCreateModal}>
                Create your first task
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {columns.map((column) => {
              const Icon = column.icon;
              const columnTasks = groupedTasks[column.key];

              return (
                <section key={column.key} className="space-y-3">
                  <div className={cn("rounded-[18px] border px-4 py-4", column.panelClass)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{column.title}</p>
                        <p className="mt-1 text-xs opacity-80">{column.description}</p>
                      </div>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold">
                        {columnTasks.length}
                      </span>
                    </div>
                  </div>

                  {columnTasks.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-border bg-white px-4 py-6 text-sm text-muted">
                      Nothing here yet.
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const priority = getPriorityMeta(task.priority);
                      const dueMeta = getTaskDueMeta(task, timezone);
                      const isCompleting = completingTaskId === task.id;
                      const isJustCompleted = completedTaskId === task.id;

                      return (
                        <article
                          key={task.id}
                          className={cn(
                            "surface-panel relative overflow-hidden rounded-[18px] p-4 transition-all duration-300",
                            isCompleting && "scale-[0.99] opacity-75",
                            isJustCompleted && "task-complete-pop border-[#86efac] bg-[#f0fdf4]",
                          )}
                        >
                          {isJustCompleted ? (
                            <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-end">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#16a34a] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(22,163,74,0.22)]">
                                <CheckCircle2 className="size-3.5" />
                                Done
                              </span>
                            </div>
                          ) : null}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={dueMeta.tone}>{dueMeta.label}</Badge>
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]",
                                    priority.className,
                                  )}
                                >
                                  {priority.label}
                                </span>
                              </div>
                              <h3 className="mt-3 text-base font-semibold leading-snug">{task.title}</h3>
                              {task.description ? (
                                <p className="mt-1.5 line-clamp-2 text-sm text-muted">{task.description}</p>
                              ) : null}
                            </div>
                            <span
                              className={cn(
                                "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px]",
                                column.iconClass,
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                          </div>

                          <div className="mt-4 border-t border-border/80 pt-3">
                            <div className="flex items-start gap-2 text-sm text-muted">
                              <AlertTriangle
                                className={cn(
                                  "mt-0.5 size-4 shrink-0",
                                  dueMeta.tone === "danger" ? "text-[#dc2626]" : "text-muted",
                                )}
                              />
                              <p>{dueMeta.detail}</p>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {task.status === "DONE" ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => mutate(`/api/tasks/${task.id}/reopen`, "POST")}
                                >
                                  <RotateCcw className="size-4" />
                                  Reopen
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => completeTask(task.id)} disabled={isCompleting || isPending}>
                                  <Check className={cn("size-4", isCompleting && "animate-pulse")} />
                                  {isCompleting ? "Completing..." : "Complete"}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Edit ${task.title}`}
                                title={`Edit ${task.title}`}
                                onClick={() => openEditModal(task)}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Delete ${task.title}`}
                                title={`Delete ${task.title}`}
                                className="text-[#b91c1c] hover:bg-[#fee2e2] hover:text-[#b91c1c]"
                                onClick={() => mutate(`/api/tasks/${task.id}`, "DELETE")}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={isOpen} onClose={closeModal} title={editing ? "Edit task" : "Create task"}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Title</label>
              <Input
                required
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Submit release notes"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional supporting notes"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Status</label>
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as TaskFormState["status"],
                  }))
                }
              >
                <option value="TODO">TODO</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="DONE">DONE</option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Priority</label>
              <Select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as TaskFormState["priority"],
                  }))
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Due date</label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Due time</label>
              <Input
                type="time"
                value={form.dueTime}
                onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : editing ? "Save changes" : "Create task"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
