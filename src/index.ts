import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';

const environmentVariables = [
  'RAILWAY_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'GIT_COMMIT_SHA',
  'COMMIT_SHA',
  'SOURCE_VERSION',
] as const;

const diskCache = new Map<string, string>();
const commitHashPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

const readText = (path: string) => {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return null;
  }
};

const findRepositoryRoot = (directory: string) => {
  let current = resolve(directory);
  const filesystemRoot = parse(current).root;

  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    if (current === filesystemRoot) return null;
    current = dirname(current);
  }
};

const getGitDirectory = (repositoryRoot: string) => {
  const dotGit = join(repositoryRoot, '.git');
  const marker = readText(dotGit);

  if (!marker?.startsWith('gitdir:')) return dotGit;

  const path = marker.slice('gitdir:'.length).trim();
  return isAbsolute(path) ? path : resolve(repositoryRoot, path);
};

const getCommonDirectory = (gitDirectory: string) => {
  const path = readText(join(gitDirectory, 'commondir'));
  return path ? resolve(gitDirectory, path) : gitDirectory;
};

const readPackedRef = (gitDirectory: string, reference: string) => {
  const packedRefs = readText(join(gitDirectory, 'packed-refs'));
  if (!packedRefs) return null;

  for (const line of packedRefs.split('\n')) {
    if (line.startsWith('#') || line.startsWith('^')) continue;
    const [hash, name] = line.trim().split(/\s+/, 2);
    if (name === reference) return hash ?? null;
  }

  return null;
};

const resolveReference = (
  reference: string,
  gitDirectories: string[],
  seen = new Set<string>(),
): string | null => {
  if (
    !reference.startsWith('refs/') ||
    reference.split('/').includes('..') ||
    reference.includes('\\')
  ) {
    return null;
  }
  if (seen.has(reference)) return null;
  seen.add(reference);

  for (const gitDirectory of gitDirectories) {
    const value = readText(join(gitDirectory, reference));
    if (!value) continue;
    if (value.startsWith('ref:')) {
      return resolveReference(value.slice('ref:'.length).trim(), gitDirectories, seen);
    }
    return value;
  }

  for (const gitDirectory of gitDirectories) {
    const value = readPackedRef(gitDirectory, reference);
    if (value) return value;
  }

  return null;
};

export const getHashFromDisk = (directory = process.cwd()) => {
  const repositoryRoot = findRepositoryRoot(directory);
  if (!repositoryRoot) return null;

  const cached = diskCache.get(repositoryRoot);
  if (cached) return cached;

  const gitDirectory = getGitDirectory(repositoryRoot);
  const commonDirectory = getCommonDirectory(gitDirectory);
  const gitDirectories = [...new Set([gitDirectory, commonDirectory])];
  const head = readText(join(gitDirectory, 'HEAD'));
  if (!head) return null;

  const hash = head.startsWith('ref:')
    ? resolveReference(head.slice('ref:'.length).trim(), gitDirectories)
    : head;

  if (!hash || !commitHashPattern.test(hash)) return null;

  diskCache.set(repositoryRoot, hash);
  return hash;
};

export const getHashFromEnvironment = () => {
  for (const variable of environmentVariables) {
    const value = process.env[variable]?.trim();
    if (value) return value;
  }
  return null;
};

export const getCommitHash = (directory?: string) =>
  getHashFromEnvironment() ?? getHashFromDisk(directory) ?? 'unknown';
