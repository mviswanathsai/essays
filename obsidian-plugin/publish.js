const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const defaultRepo = path.join(os.homedir(), 'essays');
const defaultState = path.join(defaultRepo, 'obsidian-plugin', 'data.json');

async function git(repo, ...args) {
  try {
    return (await exec('git', ['-C', repo, ...args])).stdout.trim();
  } catch (error) {
    throw new Error(error.stderr?.trim() || error.message);
  }
}

async function readState(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { posts: {} };
    throw error;
  }
}

function slug(title) {
  return title.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'essay';
}

function withPublishedDate(content, date) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return `---\ndate: ${date}\n---\n\n${content}`;
  const fields = frontmatter[1].split(/\r?\n/).filter(line => !/^date:\s*/.test(line)).join('\n');
  return `---\ndate: ${date}\n${fields ? `${fields}\n` : ''}---\n${content.slice(frontmatter[0].length)}`;
}

async function publishEssay(key, content, { repo = defaultRepo, stateFile = defaultState } = {}) {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart();
  const title = body.match(/^# (.+?)(?:\r?\n|$)/)?.[1]?.trim();
  if (!title) throw new Error('Start the note with a # title.');

  const state = await readState(stateFile);
  const previous = state.posts[key];
  const today = new Date();
  const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')].join('-');
  const name = previous || `${date}-${slug(title)}.md`;
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(name)) throw new Error('Invalid saved essay path.');
  const relative = `_posts/${name}`;
  const target = path.join(repo, relative);

  await git(repo, 'pull', '--ff-only');
  let publishedAt = today.toISOString();
  try {
    const published = await fs.readFile(target, 'utf8');
    if (!previous) throw new Error(`An essay already exists at ${name}. Change its title first.`);
    if (await git(repo, 'status', '--porcelain', '--', relative)) {
      throw new Error('The local essay has unsaved Git changes. Resolve them before publishing.');
    }
    publishedAt = published.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
      ?.match(/^date:\s*(.+)$/m)?.[1]?.trim()
      || (await git(repo, 'log', '--reverse', '--format=%aI', '--', relative)).split('\n')[0]
      || publishedAt;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (!previous) {
    state.posts[key] = name;
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');
  }
  await fs.writeFile(target, withPublishedDate(content, publishedAt));
  await git(repo, 'add', '--', relative);
  if (await git(repo, 'diff', '--cached', '--name-only', '--', relative)) {
    await git(repo, 'commit', '--only', '-m', `Publish ${title}`, '--', relative);
  }
  await git(repo, 'push');
  return `https://mviswanathsai.github.io/essays/${name.slice(11, -3)}/`;
}

async function moveNote(oldPath, newPath, { stateFile = defaultState } = {}) {
  const state = await readState(stateFile);
  if (!state.posts[oldPath]) return;
  state.posts[newPath] = state.posts[oldPath];
  delete state.posts[oldPath];
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');
}

module.exports = { publishEssay, moveNote };
