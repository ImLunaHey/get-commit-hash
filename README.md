# get-commit-hash

Get the current Git commit hash from deployment environment variables or a
local repository. Supports loose and packed refs, detached HEADs, nested
directories, and Git worktrees without spawning a `git` process.

## Install

```bash
npm install get-commit-hash
```

## Usage

```ts
import { getCommitHash } from 'get-commit-hash';

const hash = getCommitHash();
console.log(hash); // full commit hash, or "unknown"
```

By default, the package searches upward from `process.cwd()` for a `.git`
directory or worktree file. Pass a directory to start somewhere else:

```ts
const hash = getCommitHash('/path/to/repository/packages/api');
```

## API

### `getCommitHash(directory?)`

Returns the first available deployment environment value, then checks the
repository on disk. Returns `"unknown"` when neither source is available.

### `getHashFromEnvironment()`

Checks these variables in order:

1. `RAILWAY_GIT_COMMIT_SHA`
2. `VERCEL_GIT_COMMIT_SHA`
3. `GITHUB_SHA`
4. `GIT_COMMIT_SHA`
5. `COMMIT_SHA`
6. `SOURCE_VERSION`

Returns `null` when none is set.

### `getHashFromDisk(directory?)`

Reads the repository directly and returns its current hash or `null`. Resolved
disk hashes are cached per repository root for the lifetime of the process.

## Requirements

Node.js 18 or newer. Both ESM and CommonJS are supported.

## License

MIT
