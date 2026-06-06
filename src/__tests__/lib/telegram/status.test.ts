import { describe, expect, it } from "vitest";

import { buildTelegramStatusGuidance, type TelegramStatusSnapshot } from "@/lib/telegram/status";

function makeStatus(overrides: Partial<TelegramStatusSnapshot> = {}): TelegramStatusSnapshot {
  return {
    botConfigured: true,
    botReachable: true,
    botDisplayName: "TaskFlow Bot",
    botUsername: "@taskflow_bot",
    appUrlConfigured: true,
    qstashConfigured: true,
    qstashSigningConfigured: true,
    deliveryInfrastructureReady: true,
    integrationSaved: true,
    remindersEnabled: true,
    chatConfigured: true,
    chatReachable: true,
    chatDisplayName: "@manhtan",
    botError: null,
    chatError: null,
    checkedAt: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

describe("buildTelegramStatusGuidance", () => {
  it("asks for a bot token when the user has not saved one", () => {
    const result = buildTelegramStatusGuidance(
      makeStatus({
        botConfigured: false,
        botReachable: false,
      }),
    );

    expect(result.tone).toBe("danger");
    expect(result.title).toContain("Bot");
    expect(result.steps[0]?.label).toContain("bot token");
  });

  it("asks for chat id when bot is healthy but chat is not configured", () => {
    const result = buildTelegramStatusGuidance(
      makeStatus({
        integrationSaved: false,
        chatConfigured: false,
        chatReachable: null,
      }),
    );

    expect(result.tone).toBe("warning");
    expect(result.steps.some((step) => step.field === "Chat ID")).toBe(true);
  });

  it("returns success guidance when everything is ready", () => {
    const result = buildTelegramStatusGuidance(makeStatus());

    expect(result.tone).toBe("success");
    expect(result.steps.every((step) => step.state === "done")).toBe(true);
  });

  it("asks for QStash config when bot and chat are ready but delivery infra is missing", () => {
    const result = buildTelegramStatusGuidance(
      makeStatus({
        qstashConfigured: false,
        qstashSigningConfigured: false,
        deliveryInfrastructureReady: false,
      }),
    );

    expect(result.tone).toBe("danger");
    expect(result.title).toContain("Delivery queue");
    expect(result.steps.some((step) => step.label.includes("QSTASH_TOKEN"))).toBe(true);
    expect(result.steps.some((step) => step.label.includes("signing keys"))).toBe(true);
  });
});
