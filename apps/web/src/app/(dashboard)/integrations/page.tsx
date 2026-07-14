import { Badge } from "@/components/ui/badge";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge tone="default">Disabled</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Integrations are not active</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Google, Telegram, reminders, jobs, and webhooks are intentionally outside this focused service split.
        </p>
      </div>
    </div>
  );
}