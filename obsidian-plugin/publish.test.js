const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { publishEssay, moveNote } = require('./publish');

const exec = promisify(execFile);

test('publishes only the chosen note and updates its original URL', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'essay-publisher-'));
  const repo = path.join(dir, 'work');
  const remote = path.join(dir, 'remote.git');
  const stateFile = path.join(dir, 'data.json');
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' };
  Object.assign(process.env, env);
  const git = (...args) => exec('git', args, { env });

  try {
    await git('init', '--bare', '-b', 'main', remote);
    await git('clone', remote, repo);
    await fs.mkdir(path.join(repo, '_posts'));
    await fs.writeFile(path.join(repo, 'README.md'), '# Essays\n');
    await git('-C', repo, 'add', 'README.md');
    await git('-C', repo, 'commit', '-m', 'Initial site');
    await git('-C', repo, 'push', '-u', 'origin', 'main');

    await fs.writeFile(path.join(repo, 'private.md'), 'not for publication');
    await git('-C', repo, 'add', 'private.md');

    const url = await publishEssay('draft.md', '# First thought\n\nVersion one.\n', { repo, stateFile });
    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    const target = path.join(repo, '_posts', state.posts['draft.md']);
    assert.equal(url, `https://mviswanathsai.github.io/essays/${state.posts['draft.md'].slice(11, -3)}/`);
    assert.equal(await fs.readFile(target, 'utf8'), '# First thought\n\nVersion one.\n');
    assert.equal((await git('-C', repo, 'show', '--pretty=format:', '--name-only', 'HEAD')).stdout.trim(), `_posts/${state.posts['draft.md']}`);
    assert.match((await git('-C', repo, 'status', '--porcelain', '--', 'private.md')).stdout, /^A /);

    await assert.rejects(publishEssay('another.md', '# First thought\n\nOther note.\n', { repo, stateFile }), /already exists/);
    await moveNote('draft.md', 'renamed.md', { stateFile });
    assert.equal(await publishEssay('renamed.md', '# New title\n\nVersion two.\n', { repo, stateFile }), url);
    assert.equal(await fs.readFile(target, 'utf8'), '# New title\n\nVersion two.\n');
    assert.equal((await git('-C', repo, 'rev-list', '--count', 'HEAD')).stdout.trim(), '3');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
