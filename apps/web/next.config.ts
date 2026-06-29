import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import path from 'node:path';

const cwd = process.cwd();
const workspaceRoot = path.basename(cwd) === 'web' && path.basename(path.dirname(cwd)) === 'apps'
  ? path.resolve(cwd, '../..')
  : cwd;

loadEnvConfig(workspaceRoot, process.env.NODE_ENV !== 'production', undefined, true);

const nextConfig: NextConfig = {};

export default nextConfig;
