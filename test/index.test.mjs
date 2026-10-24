import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  getCommitHash,
  getHashFromDisk,
  getHashFromEnvironment,
} from '../dist/index.js';

const environmentNames = [
  'RAILWAY_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'GIT_COMMIT_SHA',
  'COMMIT_SHA',
  'SOURCE_VERSION',
];

const savedEnvironment = Object.fromEntries(
  environmentNames.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of environmentNames) {
    const value = savedEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const repository = () => {
  const root = mkdtempSync(join(tmpdir(), 'get-commit-hash-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  return root;
};

test('reads a detached HEAD', () => {
  const root = repository();
  const hash = 'a'.repeat(40);
  writeFileSync(join(root, '.git', 'HEAD'), `${hash}\n`);
  assert.equal(getHashFromDisk(root), hash);
});

test('rejects invalid detached HEAD contents', () => {
  const root = repository();
  writeFileSync(join(root, '.git', 'HEAD'), 'not-a-commit\n');
  assert.equal(getHashFromDisk(root), null);
});

test('reads a loose ref while starting in a nested directory', () => {
  const root = repository();
  const nested = join(root, 'packages', 'api');
  const hash = 'b'.repeat(40);
  mkdirSync(nested, { recursive: true });
  mkdirSync(join(root, '.git', 'refs', 'heads'), { recursive: true });
  writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(root, '.git', 'refs', 'heads', 'main'), `${hash}\n`);
  assert.equal(getHashFromDisk(nested), hash);
});

test('reads a packed ref', () => {
  const root = repository();
  const hash = 'c'.repeat(40);
  writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(
    join(root, '.git', 'packed-refs'),
    `# pack-refs with: peeled fully-peeled sorted\n${hash} refs/heads/main\n`,
  );
  assert.equal(getHashFromDisk(root), hash);
});

test('rejects a ref path that escapes the Git directory', () => {
  const root = repository();
  writeFileSync(join(root, '.git', 'HEAD'), 'ref: ../../outside\n');
  writeFileSync(join(root, 'outside'), 'not-a-commit\n');
  assert.equal(getHashFromDisk(root), null);
});

test('reads refs from a linked worktree common directory', () => {
  const parent = mkdtempSync(join(tmpdir(), 'get-commit-hash-worktree-'));
  const common = join(parent, 'main.git');
  const worktreeGit = join(common, 'worktrees', 'feature');
  const checkout = join(parent, 'feature');
  const hash = 'd'.repeat(40);

  mkdirSync(join(common, 'refs', 'heads'), { recursive: true });
  mkdirSync(worktreeGit, { recursive: true });
  mkdirSync(checkout, { recursive: true });
  writeFileSync(join(checkout, '.git'), `gitdir: ${worktreeGit}\n`);
  writeFileSync(join(worktreeGit, 'commondir'), '../..\n');
  writeFileSync(join(worktreeGit, 'HEAD'), 'ref: refs/heads/feature\n');
  writeFileSync(join(common, 'refs', 'heads', 'feature'), `${hash}\n`);

  assert.equal(getHashFromDisk(checkout), hash);
});

test('caches disk hashes per repository instead of globally', () => {
  const first = repository();
  const second = repository();
  const firstHash = 'e'.repeat(40);
  const secondHash = 'f'.repeat(40);
  writeFileSync(join(first, '.git', 'HEAD'), firstHash);
  writeFileSync(join(second, '.git', 'HEAD'), secondHash);

  assert.equal(getHashFromDisk(first), firstHash);
  assert.equal(getHashFromDisk(second), secondHash);
});

test('prefers deployment environment variables', () => {
  for (const name of environmentNames) delete process.env[name];
  process.env.GITHUB_SHA = 'github-hash';
  process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-hash';

  assert.equal(getHashFromEnvironment(), 'railway-hash');
  assert.equal(getCommitHash(resolve('/not/a/repository')), 'railway-hash');
});

test('returns null or unknown outside a repository', () => {
  for (const name of environmentNames) delete process.env[name];
  const directory = mkdtempSync(join(tmpdir(), 'get-commit-hash-empty-'));
  assert.equal(getHashFromDisk(directory), null);
  assert.equal(getCommitHash(directory), 'unknown');
});
