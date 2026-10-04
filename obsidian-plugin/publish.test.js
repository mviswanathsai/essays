const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const vm = require('node:vm');
const { publishEssay, unpublishEssay, isPublished, moveNote } = require('./publish');

const exec = promisify(execFile);

test('installed bundle loads and registers the publish action', async () => {
  const mod = { exports: {} };
  const actions = [];
  const icons = [];
  const listeners = {};
  let activeView = null;
  class Plugin {
    constructor() {
      this.app = { workspace: { getActiveViewOfType: () => activeView,
        on: (event, callback) => { listeners[event] = callback; return null; },
        onLayoutReady: callback => callback() }, vault: { on: () => null } };
    }
    addRibbonIcon(icon, label, action) {
      const item = { icon, label, action, style: { display: '' } };
      icons.push(item);
      return item;
    }
    addCommand(command) { actions.push(command); }
    registerEvent() {}
  }
  const code = await fs.readFile(path.join(__dirname, 'main.js'), 'utf8');
  vm.runInNewContext(code, {
    module: mod,
    require(id) {
      if (id === 'obsidian') return { Plugin, MarkdownView: class {}, Notice: class {} };
      assert.ok(id.startsWith('node:'), `Unexpected unbundled import: ${id}`);
      if (id === 'node:fs/promises') return { ...fs, readFile: (file, ...args) =>
        String(file).endsWith('/obsidian-plugin/data.json')
          ? Promise.resolve(JSON.stringify({ posts: { 'draft.md': '2026-10-04-draft.md' } }))
          : fs.readFile(file, ...args) };
      return require(id);
    },
  });
  await new mod.exports().onload();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(icons[0].label, 'Publish active essay');
  assert.equal(icons[1].label, 'Unpublish active essay');
  assert.equal(icons[1].style.display, 'none');
  assert.equal(actions[0].id, 'publish-active-essay');
  assert.equal(actions[1].id, 'unpublish-active-essay');
  activeView = { file: { path: 'draft.md' } };
  listeners['file-open']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(icons[1].style.display, '');
  activeView = null;
  listeners['active-leaf-change']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(icons[1].style.display, 'none');
});

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

    const clickedAt = Date.now();
    const url = await publishEssay('draft.md', '# First thought\n\nVersion one.\n', { repo, stateFile });
    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    const target = path.join(repo, '_posts', state.posts['draft.md']);
    const firstCopy = await fs.readFile(target, 'utf8');
    const publishedAt = firstCopy.match(/^---\ndate: (.+)\n---/)[1];
    assert.equal(url, `https://mviswanathsai.github.io/essays/${state.posts['draft.md'].slice(11, -3)}/`);
    assert.ok(Date.parse(publishedAt) >= clickedAt && Date.parse(publishedAt) <= Date.now());
    assert.equal(firstCopy, `---\ndate: ${publishedAt}\n---\n\n# First thought\n\nVersion one.\n`);
    assert.equal((await git('-C', repo, 'show', '--pretty=format:', '--name-only', 'HEAD')).stdout.trim(), `_posts/${state.posts['draft.md']}`);
    assert.match((await git('-C', repo, 'status', '--porcelain', '--', 'private.md')).stdout, /^A /);

    await assert.rejects(publishEssay('another.md', '# First thought\n\nOther note.\n', { repo, stateFile }), /already exists/);
    await moveNote('draft.md', 'renamed.md', { stateFile });
    const revision = '---\ndate: 1999-01-01\ncategory: thoughts\n---\n# New title\n\nVersion two.\n';
    assert.equal(await publishEssay('renamed.md', revision, { repo, stateFile }), url);
    assert.equal(await fs.readFile(target, 'utf8'), `---\ndate: ${publishedAt}\ncategory: thoughts\n---\n# New title\n\nVersion two.\n`);
    assert.equal((await git('-C', repo, 'rev-list', '--count', 'HEAD')).stdout.trim(), '3');

    assert.equal(await isPublished('renamed.md', { stateFile }), true);
    await fs.appendFile(target, 'Local edit.\n');
    await assert.rejects(unpublishEssay('renamed.md', { repo, stateFile }), /unsaved Git changes/);
    await fs.writeFile(target, `---\ndate: ${publishedAt}\ncategory: thoughts\n---\n# New title\n\nVersion two.\n`);
    await unpublishEssay('renamed.md', { repo, stateFile });
    assert.equal(await isPublished('renamed.md', { stateFile }), false);
    await assert.rejects(fs.access(target), { code: 'ENOENT' });
    await assert.rejects(git('--git-dir', remote, 'show', `main:_posts/${state.posts['draft.md']}`));
    assert.match((await git('-C', repo, 'status', '--porcelain', '--', 'private.md')).stdout, /^A /);
    assert.equal((await git('-C', repo, 'rev-list', '--count', 'HEAD')).stdout.trim(), '4');

    const republishedAt = Date.now();
    assert.notEqual(await publishEssay('renamed.md', '# New title\n\nBack online.\n', { repo, stateFile }), url);
    const newState = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    const newPost = await fs.readFile(path.join(repo, '_posts', newState.posts['renamed.md']), 'utf8');
    assert.ok(Date.parse(newPost.match(/^---\ndate: (.+)\n---/)[1]) >= republishedAt);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
