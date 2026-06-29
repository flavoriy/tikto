import { getSupabaseConfig } from "../../shared/src/supabase/env";

export type HealthDatabaseClient = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

type DependencyTarget = {
  service: string;
  env: string;
  url?: string | null;
};

type DependencyHealthBody =
  | {
      success: true;
      data: {
        ok?: boolean;
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

type ServiceHealthInput = {
  serviceName: string;
  prisma?: HealthDatabaseClient;
  databaseEnv?: string;
  ownedTables?: string[];
  dependencies?: DependencyTarget[];
  requiredEnv?: readonly string[];
  optionalEnv?: readonly string[];
};

function envStatus(names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        configured: Boolean(process.env[name]),
      },
    ]),
  );
}

function trimBase64Padding(str: string): string {
  if (str.endsWith("==")) {
    return str.slice(0, -2);
  }

  if (str.endsWith("=")) {
    return str.slice(0, -1);
  }

  return str;
}

function stripTrailingSlashes(value: string) {
  let end = value.length;

  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1;
  }

  return value.slice(0, end);
}

function getDatabaseHostKind(host: string) {
  if (host.startsWith("db.") && host.endsWith(".supabase.co")) {
    return "supabase-direct";
  }

  if (host.endsWith(".pooler.supabase.com")) {
    return "supabase-pooler";
  }

  return "custom";
}

function getSupabaseKeySource() {
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  }

  return null;
}

function encryptionKeyStatus() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    return { configured: false, validBase64: false, byteLength: 0, validLength: false };
  }

  try {
    const bytes = Buffer.from(raw, "base64");
    return {
      configured: true,
      validBase64: trimBase64Padding(bytes.toString("base64")) === trimBase64Padding(raw),
      byteLength: bytes.length,
      validLength: bytes.length === 32,
    };
  } catch {
    return { configured: true, validBase64: false, byteLength: 0, validLength: false };
  }
}

function databaseUrlStatus(databaseEnv = "DATABASE_URL") {
  const raw = process.env[databaseEnv] ?? process.env.DATABASE_URL;
  if (!raw) {
    return {
      configured: false,
      source: null,
      validUrl: false,
      hostKind: null,
      port: null,
      recommendation: `Set ${databaseEnv}${databaseEnv === "DATABASE_URL" ? "" : " or DATABASE_URL"}.`,
    };
  }

  try {
    const url = new URL(raw);
    const hostKind = getDatabaseHostKind(url.hostname);

    return {
      configured: true,
      source: process.env[databaseEnv] ? databaseEnv : "DATABASE_URL",
      validUrl: true,
      hostKind,
      port: url.port || null,
      recommendation: hostKind === "supabase-direct"
        ? "Hosted runtimes may not reach Supabase direct database hosts because they require IPv6. Use the Supabase Connection Pooler/Supavisor DATABASE_URL instead."
        : null,
    };
  } catch {
    return {
      configured: true,
      source: process.env[databaseEnv] ? databaseEnv : "DATABASE_URL",
      validUrl: false,
      hostKind: null,
      port: null,
      recommendation: `${databaseEnv} is not a valid URL.`,
    };
  }
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const valuesToRedact = [
    process.env.DATABASE_URL,
    process.env.PROFILE_DATABASE_URL,
    process.env.TASKS_DATABASE_URL,
    process.env.CALENDAR_DATABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.TOKEN_ENCRYPTION_KEY,
    process.env.TIKTO_INTERNAL_API_KEY,
  ].filter(Boolean) as string[];

  return valuesToRedact.reduce(
    (safeMessage, value) => safeMessage.replaceAll(value, "[redacted]"),
    message,
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

async function checkDatabase(prisma: HealthDatabaseClient, ownedTables: string[]) {
  try {
    const [ping, tableResults] = await withTimeout(
      Promise.all([
        prisma.$queryRaw`select 1 as ok`,
        Promise.all(
          ownedTables.map((table) =>
            prisma.$queryRawUnsafe<Array<{ exists: string | null }>>(
              "select to_regclass($1)::text as exists",
              table,
            ),
          ),
        ),
      ]),
      2500,
      "Database health check timed out.",
    );

    const tables = Object.fromEntries(
      ownedTables.map((table, index) => [table, tableResults[index]?.[0]?.exists ?? null]),
    );

    return {
      ok: Object.values(tables).every(Boolean),
      ping: Array.isArray(ping),
      ownedTables: tables,
    };
  } catch (error) {
    return {
      ok: false,
      error: sanitizeError(error),
    };
  }
}

async function checkDependency(target: DependencyTarget) {
  const url = target.url ?? process.env[target.env];

  if (!url) {
    return {
      service: target.service,
      ok: false,
      configured: false,
      env: target.env,
      error: `${target.env} is not configured.`,
    };
  }

  const headers = new Headers();
  const internalKey = process.env.TIKTO_INTERNAL_API_KEY;

  if (internalKey) {
    headers.set("x-tikto-internal-key", internalKey);
  }

  try {
    const response = await fetch(`${stripTrailingSlashes(url)}/health`, {
      headers,
    });
    const body = await response.json().catch(() => null) as DependencyHealthBody | null;

    return {
      service: target.service,
      ok: response.ok && Boolean(body?.success && body.data?.ok),
      configured: true,
      env: target.env,
      status: response.status,
      data: body?.success ? body.data : body,
    };
  } catch (error) {
    return {
      service: target.service,
      ok: false,
      configured: true,
      env: target.env,
      error: sanitizeError(error),
    };
  }
}

export async function getServiceHealth(input: ServiceHealthInput) {
  const databaseEnv = input.databaseEnv ?? "DATABASE_URL";
  const requiredEnv = input.requiredEnv ?? [];
  const optionalEnv = input.optionalEnv ?? [
    "TOKEN_ENCRYPTION_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "TIKTO_INTERNAL_API_KEY",
  ];
  const env = envStatus(requiredEnv);
  const providers = envStatus(optionalEnv);
  const supabase = getSupabaseConfig();
  const databaseUrl = input.prisma ? databaseUrlStatus(databaseEnv) : null;
  const database = input.prisma
    ? await checkDatabase(input.prisma, input.ownedTables ?? [])
    : null;
  const dependencies = input.dependencies
    ? await Promise.all(input.dependencies.map(checkDependency))
    : [];
  const encryption = encryptionKeyStatus();
  const ok =
    Object.values(env).every((status) => status.configured) &&
    (!database || database.ok) &&
    dependencies.every((dependency) => dependency.ok);

  return {
    ok,
    checkedAt: new Date().toISOString(),
    service: input.serviceName,
    env,
    supabase: {
      publicKeyConfigured: Boolean(supabase.publishableKey),
      keySource: getSupabaseKeySource(),
    },
    providers,
    encryption,
    databaseUrl,
    database,
    dependencies,
  };
}
