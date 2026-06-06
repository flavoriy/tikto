export type TelegramStatusSnapshot = {
  botConfigured: boolean;
  botReachable: boolean;
  botDisplayName: string | null;
  botUsername: string | null;
  appUrlConfigured: boolean;
  qstashConfigured: boolean;
  qstashSigningConfigured: boolean;
  deliveryInfrastructureReady: boolean;
  integrationSaved: boolean;
  remindersEnabled: boolean;
  chatConfigured: boolean;
  chatReachable: boolean | null;
  chatDisplayName: string | null;
  botError: string | null;
  chatError: string | null;
  checkedAt: string | null;
};

export type TelegramSetupStep = {
  state: "done" | "action";
  label: string;
  detail: string;
  field: string | null;
};

export type TelegramSetupGuidance = {
  tone: "success" | "warning" | "danger";
  title: string;
  description: string;
  steps: TelegramSetupStep[];
};

function buildInfrastructureSteps(status: TelegramStatusSnapshot): TelegramSetupStep[] {
  const doneSteps: TelegramSetupStep[] = [
    {
      state: "done",
      label: "Bot is connected",
      detail: "Telegram responded to the bot token.",
      field: null,
    },
    {
      state: "done",
      label: "Chat is verified",
      detail: status.chatDisplayName ?? "The saved chat target is reachable.",
      field: null,
    },
  ];

  const missingSteps: TelegramSetupStep[] = [];

  if (!status.appUrlConfigured) {
    missingSteps.push({
      state: "action",
      label: "Add NEXT_PUBLIC_APP_URL",
      detail: "Set the public app URL so QStash can call the reminder webhook.",
      field: "Server env",
    });
  }

  if (!status.qstashConfigured) {
    missingSteps.push({
      state: "action",
      label: "Add QSTASH_TOKEN",
      detail: "Copy the token from Upstash QStash into your environment variables.",
      field: "Server env",
    });
  }

  if (!status.qstashSigningConfigured) {
    missingSteps.push({
      state: "action",
      label: "Add QStash signing keys",
      detail: "Set QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY so webhook requests can be verified.",
      field: "Server env",
    });
  }

  return [...doneSteps, ...missingSteps];
}

export function buildTelegramStatusGuidance(status: TelegramStatusSnapshot): TelegramSetupGuidance {
  if (!status.botConfigured) {
    return {
      tone: "danger",
      title: "Bot token is not saved",
      description: "This user does not have a saved bot token yet, so reminders cannot be sent.",
      steps: [
        {
          state: "action",
          label: "Save bot token",
          detail: "Create or open the bot in BotFather, copy the token, paste it into Bot token, then save Telegram.",
          field: "Bot token",
        },
        {
          state: "action",
          label: "Check status again",
          detail: "After saving, use Check status to confirm this deployment can reach Telegram with that user's bot.",
          field: null,
        },
      ],
    };
  }

  if (!status.botReachable) {
    return {
      tone: "danger",
      title: "Bot cannot be reached",
      description: "The token may be wrong, revoked, or blocked by network access.",
      steps: [
        {
          state: "action",
          label: "Check saved bot token",
          detail: status.botError ?? "Confirm the token was copied exactly from BotFather.",
          field: "Bot token",
        },
        {
          state: "action",
          label: "Try status again",
          detail: "Replace the token if needed, save Telegram, then run Check status.",
          field: null,
        },
      ],
    };
  }

  if (!status.integrationSaved || !status.chatConfigured) {
    return {
      tone: "warning",
      title: "Choose where reminders should land",
      description: "The bot works, but the app does not have a saved Telegram Chat ID for this user.",
      steps: [
        {
          state: "done",
          label: "Bot is connected",
          detail: status.botDisplayName
            ? `${status.botDisplayName}${status.botUsername ? ` (${status.botUsername})` : ""}`
            : "Telegram responded to the bot token.",
          field: null,
        },
        {
          state: "action",
          label: "Enter Chat ID",
          detail: "Message the bot first, find the personal or group chat.id, then paste it into Chat ID.",
          field: "Chat ID",
        },
        {
          state: "action",
          label: "Save and verify",
          detail: "After saving, run Check status to confirm the bot can see the chat.",
          field: null,
        },
      ],
    };
  }

  if (status.chatReachable === false) {
    return {
      tone: "warning",
      title: "Chat ID needs attention",
      description: "The bot is alive, but the saved chat could not be verified.",
      steps: [
        {
          state: "done",
          label: "Bot is connected",
          detail: "Telegram responded to the bot token.",
          field: null,
        },
        {
          state: "action",
          label: "Check Chat ID",
          detail: status.chatError ?? "The Chat ID may be wrong, or the bot has not received a message there yet.",
          field: "Chat ID",
        },
        {
          state: "action",
          label: "Message the bot, then retry",
          detail: "Send /start to the bot, or add it to the group and send a message, then run Check status.",
          field: null,
        },
      ],
    };
  }

  if (!status.remindersEnabled) {
    return {
      tone: "warning",
      title: "Connection works, reminders are off",
      description: "The bot and chat are valid, but Telegram reminders are disabled for this user.",
      steps: [
        {
          state: "done",
          label: "Bot is connected",
          detail: "Telegram responded to the bot token.",
          field: null,
        },
        {
          state: "done",
          label: "Chat is verified",
          detail: status.chatDisplayName ?? "The saved chat target is reachable.",
          field: null,
        },
        {
          state: "action",
          label: "Enable reminders",
          detail: "Turn on the reminder checkbox and save the Telegram settings.",
          field: "Enable Telegram reminders",
        },
      ],
    };
  }

  if (!status.deliveryInfrastructureReady) {
    return {
      tone: "danger",
      title: "Delivery queue needs config",
      description: "The bot and chat are valid, but scheduled reminder delivery is missing server env.",
      steps: buildInfrastructureSteps(status),
    };
  }

  return {
    tone: "success",
    title: "Telegram reminders are ready",
    description: "The bot, chat, user setting, and delivery queue are all configured.",
    steps: [
      {
        state: "done",
        label: "Bot is connected",
        detail: status.botDisplayName
          ? `${status.botDisplayName}${status.botUsername ? ` (${status.botUsername})` : ""}`
          : "Telegram responded to the bot token.",
        field: null,
      },
      {
        state: "done",
        label: "Chat is verified",
        detail: status.chatDisplayName ?? "The saved chat target is reachable.",
        field: null,
      },
      {
        state: "done",
        label: "Reminders are enabled",
        detail: "This user can receive Telegram reminders.",
        field: null,
      },
    ],
  };
}
