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
      try {
        await fs.access(target);
        if (!previous) throw new Error(`An essay already exists at ${name}. Change its title first.`);
        if (await git(repo, "status", "--porcelain", "--", relative)) {
          throw new Error("The local essay has unsaved Git changes. Resolve them before publishing.");
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (!previous) {
        state.posts[key] = name;
        await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n");
      }
      await fs.writeFile(target, content);
      await git(repo, "add", "--", relative);
      if (await git(repo, "diff", "--cached", "--name-only", "--", relative)) {
        await git(repo, "commit", "--only", "-m", `Publish ${title}`, "--", relative);
      }
      await git(repo, "push");
      return `https://mviswanathsai.github.io/essays/${name.slice(11, -3)}/`;
    }
    async function moveNote2(oldPath, newPath, { stateFile = defaultState } = {}) {
      const state = await readState(stateFile);
      if (!state.posts[oldPath]) return;
      state.posts[newPath] = state.posts[oldPath];
      delete state.posts[oldPath];
      await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n");
    }
    module2.exports = { publishEssay: publishEssay2, moveNote: moveNote2 };
  }
});

// obsidian-plugin/src.js
var { Plugin, MarkdownView, Notice } = require("obsidian");
var { publishEssay, moveNote } = require_publish();
module.exports = class EssayPublisher extends Plugin {
  async onload() {
    let busy = false;
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
      }
    };
    this.addRibbonIcon("upload", "Publish active essay", publish);
    this.addCommand({ id: "publish-active-essay", name: "Publish active essay", callback: publish });
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      moveNote(oldPath, file.path).catch((error) => new Notice(`Essay link: ${error.message}`));
    }));
  }
};
