# Essays

[Read the essays](https://mviswanathsai.github.io/essays/).

A small GitHub Pages site for selected writing. The site lives in its own
repository; only essays copied here become public.

## Publish an essay

In Obsidian, open the note and click the **Publish active essay** upload icon
in the left ribbon (or run the command from the command palette). The first
click publishes it; later clicks update the same essay. The source note stays
in your vault. The plugin uses the local `~/essays` checkout and your existing
Git credentials. It is desktop-only and stores the note-to-essay mapping in
its ignored `obsidian-plugin/data.json` file.
The site shows the time of the first Publish click in India time. Later edits
keep that original publication time, even if the note has an older `date` field.
For a published note, an **Unpublish active essay** cloud-off icon appears in the
left ribbon. It removes only the public copy. The vault note stays as it was.
Publishing again starts a new publication time.

If you wrote an essay earlier, add an optional `written` date property to the
Obsidian note (using **Add property** or by typing the front matter yourself):

```markdown
---
written: 2026-09-15
---

# The essay title
```

Use the day you consider the essay written, in `YYYY-MM-DD` format. The essay
page shows both dates when the written day differs from the publication day;
otherwise it shows only Published. The plugin sets the publication date on the
public copy and keeps it when you update the essay. The index stays ordered by
publication date.

For manual publishing, copy one selected Markdown file to
`_posts/YYYY-MM-DD-short-name.md`, using the date you want shown on the site.
Put `# The essay title` at the top. No other metadata is needed. GitHub Pages
takes that heading as the title, removes it from the article body, and lists
the essay newest first on the home page.

Review the copy for private details and local-only links before committing it.
From this repository:

```sh
cp /path/to/selected-note.md _posts/2026-10-04-selected-note.md
git add _posts/2026-10-04-selected-note.md
git commit -m "Publish selected note"
git push
```

GitHub Pages rebuilds the site on each push. No index to edit.

GitHub Pages runs Jekyll for you. Its built-in title-from-heading plugin lets
the posts stay plain Markdown, including files copied from a local workspace.

The Obsidian plugin uses a bundled `main.js`. Rebuild it after editing `src.js`
or `publish.js`:

```sh
npx --yes esbuild@0.25.5 obsidian-plugin/src.js --bundle --platform=node --format=cjs --target=es2021 --external:obsidian --outfile=obsidian-plugin/main.js
```

Install `main.js` and `manifest.json` in a real directory named
`.obsidian/plugins/essay-publisher/` inside the vault. The publisher keeps its
local mapping in the ignored `~/essays/obsidian-plugin/data.json` file.
