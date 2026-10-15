# mviswanathsai.com

Portfolio and essays of M Viswanath Sai (Viswa). Static Jekyll site on GitHub
Pages. The portfolio lives at `/`; essays live under `/essays/`.

## Layout

- `index.html` - portfolio landing page (about, Fettle, research notes, writing, contact)
- `essays/index.html` - essay index at `/essays/`
- `_posts/` - essays as plain Markdown, served at `/essays/<title>/`
- `_layouts/`, `_includes/`, `assets/` - site chrome and styling
- `obsidian-plugin/` - Obsidian "publish essay" helper (desktop only)

## Custom domain

The site is built for the custom domain `https://mviswanathsai.com`
(`url`/`baseurl: ""` in `_config.yml`). Until the CNAME is added in the repo's
GitHub Pages settings and DNS points at GitHub, the Pages build at
`mviswanathsai.github.io/essays` will not resolve asset links correctly.

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

Add optional `label` and `written` properties to an Obsidian note using **Add
property** or by typing the front matter yourself:

```markdown
---
label: Note to self
written: 2026-09-15
---

# The essay title
```

The label appears above that essay's title; without one, the page says Essay.
For `written`, use the day you consider the essay written, in `YYYY-MM-DD`
format. The essay page shows both dates when the written day differs from the
publication day; otherwise it shows only Published. The plugin sets the
publication date on the public copy and keeps it when you update the essay.
The index stays ordered by publication date.

For manual publishing, copy one selected Markdown file to
`_posts/YYYY-MM-DD-short-name.md`, using the date you want shown on the site.
Put `# The essay title` at the top. No other metadata is needed. GitHub Pages
takes that heading as the title, removes it from the article body, and lists
the essay newest first on the essays page.

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
