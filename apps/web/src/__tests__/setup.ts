// 32-byte key required by AES-256-GCM — set before any test imports crypto.ts
process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/tikto_test";
