var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// obsidian-plugin/publish.js
var require_publish = __commonJS({
  "obsidian-plugin/publish.js"(exports2, module2) {
    var fs = require("node:fs/promises");
    var path = require("node:path");
    var os = require("node:os");
    var { execFile } = require("node:child_process");
    var { promisify } = require("node:util");
    var exec = promisify(execFile);
    var defaultRepo = path.join(os.homedir(), "essays");
    var defaultState = path.join(defaultRepo, "obsidian-plugin", "data.json");
    async function git(repo, ...args) {
      try {
        return (await exec("git", ["-C", repo, ...args])).stdout.trim();
      } catch (error) {
        throw new Error(error.stderr?.trim() || error.message);
      }
    }
    async function readState(file) {
      try {
        return JSON.parse(await fs.readFile(file, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return { posts: {} };
        throw error;
      }
    }
    function slug(title) {
      return title.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "essay";
    }
    function withPublishedDate(content, date) {
      const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!frontmatter) return `---
date: ${date}
---

${content}`;
      const fields = frontmatter[1].split(/\r?\n/).filter((line) => !/^date:\s*/.test(line)).join("\n");
      return `---
date: ${date}
${fields ? `${fields}
` : ""}---
${content.slice(frontmatter[0].length)}`;
    }
    async function isPublished2(key, { stateFile = defaultState } = {}) {
      return !!key && !!(await readState(stateFile)).posts[key];
    }
    async function publishEssay2(key, content, { repo = defaultRepo, stateFile = defaultState } = {}) {
      const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trimStart();
      const title = body.match(/^# (.+?)(?:\r?\n|$)/)?.[1]?.trim();
      if (!title) throw new Error("Start the note with a # title.");
      const state = await readState(stateFile);
      const previous = state.posts[key];
      const today = /* @__PURE__ */ new Date();
      const date = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
      ].join("-");
      const name = previous || `${date}-${slug(title)}.md`;
      if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(name)) throw new Error("Invalid saved essay path.");
      const relative = `_posts/${name}`;
      const target = path.join(repo, relative);
      await git(repo, "pull", "--ff-only");
      let publishedAt = today.toISOString();
      try {
        const published = await fs.readFile(target, "utf8");
        if (!previous) throw new Error(`An essay already exists at ${name}. Change its title first.`);
        if (await git(repo, "status", "--porcelain", "--", relative)) {
          throw new Error("The local essay has unsaved Git changes. Resolve them before publishing.");
        }
        publishedAt = published.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]?.match(/^date:\s*(.+)$/m)?.[1]?.trim() || (await git(repo, "log", "--reverse", "--format=%aI", "--", relative)).split("\n")[0] || publishedAt;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (!previous) {
        state.posts[key] = name;
        await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n");
      }
      await fs.mkdir(path.join(repo, "_posts"), { recursive: true });
      await fs.writeFile(target, withPublishedDate(content, publishedAt));
      await git(repo, "add", "--", relative);
      if (await git(repo, "diff", "--cached", "--name-only", "--", relative)) {
        await git(repo, "commit", "--only", "-m", `Publish ${title}`, "--", relative);
      }
      await git(repo, "push");
      return `https://mviswanathsai.github.io/essays/${name.slice(11, -3)}/`;
    }
    async function unpublishEssay2(key, { repo = defaultRepo, stateFile = defaultState } = {}) {
      const state = await readState(stateFile);
      const name = state.posts[key];
      if (!name) throw new Error("This note is not published.");
      if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(name)) throw new Error("Invalid saved essay path.");
      const relative = `_posts/${name}`;
      await git(repo, "pull", "--ff-only");
      if (await git(repo, "status", "--porcelain", "--", relative)) {
        throw new Error("The local essay has unsaved Git changes. Resolve them before unpublishing.");
      }
      try {
        await fs.access(path.join(repo, relative));
        await git(repo, "rm", "--", relative);
        await git(repo, "commit", "--only", "-m", `Unpublish ${name.slice(11, -3)}`, "--", relative);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await git(repo, "push");
      delete state.posts[key];
      await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n");
    }
    async function moveNote2(oldPath, newPath, { stateFile = defaultState } = {}) {
      const state = await readState(stateFile);
      if (!state.posts[oldPath]) return;
      state.posts[newPath] = state.posts[oldPath];
      delete state.posts[oldPath];
      await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n");
    }
    module2.exports = { publishEssay: publishEssay2, unpublishEssay: unpublishEssay2, isPublished: isPublished2, moveNote: moveNote2 };
  }
});

// obsidian-plugin/src.js
var { Plugin, MarkdownView, Notice } = require("obsidian");
var { publishEssay, unpublishEssay, isPublished, moveNote } = require_publish();
module.exports = class EssayPublisher extends Plugin {
  async onload() {
    let busy = false;
    let unpublishIcon;
    const refresh = async () => {
      const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
      try {
        const published = await isPublished(file?.path);
        if (file === this.app.workspace.getActiveViewOfType(MarkdownView)?.file) {
          unpublishIcon.style.display = published ? "" : "none";
        }
      } catch (error) {
        new Notice(`Essay status: ${error.message}`);
      }
    };
    const publish = async () => {
      if (busy) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) {
        new Notice("Open a note to publish it.");
        return;
      }
      busy = true;
      new Notice("Publishing essay\u2026");
      try {
        const content = view.editor ? view.editor.getValue() : await this.app.vault.read(view.file);
        const url = await publishEssay(view.file.path, content);
        new Notice(`Published: ${url}`, 8e3);
      } catch (error) {
        new Notice(`Publish failed: ${error.message}`, 1e4);
      } finally {
        busy = false;
        refresh();
      }
    };
    const unpublish = async () => {
      if (busy) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) {
        new Notice("Open a note to unpublish it.");
        return;
      }
      busy = true;
      new Notice("Unpublishing essay\u2026");
      try {
        await unpublishEssay(view.file.path);
        new Notice("Essay unpublished. The vault note is unchanged.");
      } catch (error) {
        new Notice(`Unpublish failed: ${error.message}`, 1e4);
      } finally {
        busy = false;
        refresh();
      }
    };
    this.addRibbonIcon("upload", "Publish active essay", publish);
    unpublishIcon = this.addRibbonIcon("cloud-off", "Unpublish active essay", unpublish);
    unpublishIcon.style.display = "none";
    this.addCommand({ id: "publish-active-essay", name: "Publish active essay", callback: publish });
    this.addCommand({ id: "unpublish-active-essay", name: "Unpublish active essay", callback: unpublish });
    this.registerEvent(this.app.workspace.on("file-open", refresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      moveNote(oldPath, file.path).then(refresh).catch((error) => new Notice(`Essay link: ${error.message}`));
    }));
    this.app.workspace.onLayoutReady(refresh);
  }
};
