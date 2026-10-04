# Essays

[Read the essays](https://mviswanathsai.github.io/essays/).

A small GitHub Pages site for selected writing. The site lives in its own
repository; only essays copied here become public.

## Publish an essay

Copy one selected Markdown file to `_posts/YYYY-MM-DD-short-name.md`, using the
date you want shown on the site. Put `# The essay title` at the top. No other
metadata is needed. GitHub Pages takes that heading as the title, removes it
from the article body, and lists the essay newest first on the home page.

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
