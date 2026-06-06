"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const timezones = [
  "Asia/Ho_Chi_Minh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

function parseReminderOffsets(value: string): { value: number[] } | { error: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { value: [] as number[] };
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length > 5) {
    return { error: "Use up to 5 reminder offsets per field." };
  }

  const offsets = parts.map((part) => Number(part));
  if (offsets.some((offset) => !Number.isInteger(offset) || offset <= 0 || offset > 43200)) {
    return { error: "Reminder offsets must be whole minutes between 1 and 43200." };
  }

  return { value: [...new Set(offsets)].sort((left, right) => left - right) };
}

export function SettingsForm({
  profile,
}: {
  profile: {
    name: string | null;
    email: string;
    timezone: string;
    defaultTaskReminderOffsetsMinutes: number[];
    defaultEventReminderOffsetsMinutes: number[];
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(profile.name ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [taskReminderOffsets, setTaskReminderOffsets] = useState(
    profile.defaultTaskReminderOffsetsMinutes.join(", "),
  );
  const [eventReminderOffsets, setEventReminderOffsets] = useState(
    profile.defaultEventReminderOffsetsMinutes.join(", "),
  );
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const taskOffsets = parseReminderOffsets(taskReminderOffsets);
    if ("error" in taskOffsets) {
      setFeedback({ tone: "error", message: taskOffsets.error });
      return;
    }

    const eventOffsets = parseReminderOffsets(eventReminderOffsets);
    if ("error" in eventOffsets) {
      setFeedback({ tone: "error", message: eventOffsets.error });
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          timezone,
          defaultTaskReminderOffsetsMinutes: taskOffsets.value,
          defaultEventReminderOffsetsMinutes: eventOffsets.value,
        }),
      });

      if (!response.ok) {
        setFeedback({ tone: "error", message: "Could not update settings." });
        return;
      }

      setFeedback({ tone: "success", message: "Settings saved." });
      router.refresh();
    });
  }

  return (
    <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,239,231,0.84))]">
      <div className="mb-6">
        <p className="section-label">Preferences</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Settings</h2>
        <p className="mt-2 text-sm text-muted">Update your profile name and choose the timezone used for task and calendar boundaries.</p>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium">Display name</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Email</label>
          <Input value={profile.email} disabled />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium">Timezone</label>
          <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {timezones.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Task reminder defaults</label>
          <Input
            value={taskReminderOffsets}
            onChange={(event) => setTaskReminderOffsets(event.target.value)}
            placeholder="15, 60"
          />
          <p className="mt-2 text-xs text-muted">Minutes before timed tasks. Leave blank to disable.</p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Event reminder defaults</label>
          <Input
            value={eventReminderOffsets}
            onChange={(event) => setEventReminderOffsets(event.target.value)}
            placeholder="15, 60"
          />
          <p className="mt-2 text-xs text-muted">Minutes before timed events. Leave blank to disable.</p>
        </div>
        <div className="md:col-span-2 panel-muted rounded-[1.25rem] p-4">
          {feedback ? (
            <p className={feedback.tone === "success" ? "text-sm text-[var(--success)]" : "text-sm text-danger"}>
              {feedback.message}
            </p>
          ) : (
            <p className="text-sm text-muted">
              Task and calendar views use this timezone for day boundaries. Telegram reminders apply only to timed
              tasks and timed events.
            </p>
          )}
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={isPending} size="lg">
            <Save className="size-4" />
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
