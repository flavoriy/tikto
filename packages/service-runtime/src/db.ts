import "./bootstrap";

type DatabaseClient = {
  $disconnect(): Promise<void>;
};

type DatabaseClientRegistry = Record<string, DatabaseClient | undefined>;

const globalForPrisma = globalThis as unknown as {
  tiktoPrismaClients?: DatabaseClientRegistry;
};

function getEnvValue(primaryEnvName: string) {
  return process.env[primaryEnvName] || process.env.DATABASE_URL;
}

export function getDatabaseUrl(primaryEnvName = "DATABASE_URL") {
  const databaseUrl = getEnvValue(primaryEnvName);

  if (!databaseUrl) {
    throw new Error(
      `Missing ${primaryEnvName}${primaryEnvName === "DATABASE_URL" ? "" : " or DATABASE_URL"} environment variable.`,
    );
  }

  try {
    const parsed = new URL(databaseUrl);

    if (!parsed.hostname) {
      throw new Error("database URL is missing a host.");
    }

    return databaseUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    throw new Error(
      `Invalid database URL from ${primaryEnvName}. If your database password contains special characters like @, #, :, or /, percent-encode them before placing the URL in .env. Original parser error: ${message}`,
    );
  }
}

export type PrismaLogLevels = Array<"warn" | "error">;

export function getPrismaLogLevels(): PrismaLogLevels {
  return process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];
}

export function createServiceDatabaseClient<TClient extends DatabaseClient>(
  serviceName: string,
  primaryEnvName: string,
  createClient: (input: {
    datasourceUrl: string;
    log: PrismaLogLevels;
  }) => TClient,
) {
  const registry = globalForPrisma.tiktoPrismaClients ?? {};
  globalForPrisma.tiktoPrismaClients = registry;

  const registryKey = `${serviceName}:${primaryEnvName}`;
  const existing = registry[registryKey] as TClient | undefined;

  if (existing) {
    return existing;
  }

  const client = createClient({
    datasourceUrl: getDatabaseUrl(primaryEnvName),
    log: getPrismaLogLevels(),
  });

  if (process.env.NODE_ENV !== "production") {
    registry[registryKey] = client;
  }

  return client;
}


