// Bundled into main.js for Obsidian; run the build command in README.md after edits.
const { Plugin, MarkdownView, Notice } = require('obsidian');
const { publishEssay, unpublishEssay, isPublished, moveNote } = require('./publish');

module.exports = class EssayPublisher extends Plugin {
  async onload() {
    let busy = false;
    let unpublishIcon;
    const refresh = async () => {
      const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
      try {
        const published = await isPublished(file?.path);
        if (file === this.app.workspace.getActiveViewOfType(MarkdownView)?.file) {
          unpublishIcon.style.display = published ? '' : 'none';
        }
      } catch (error) {
        new Notice(`Essay status: ${error.message}`);
      }
    };
    const publish = async () => {
      if (busy) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) {
        new Notice('Open a note to publish it.');
        return;
      }

      busy = true;
      new Notice('Publishing essay…');
      try {
        const content = view.editor ? view.editor.getValue() : await this.app.vault.read(view.file);
        const url = await publishEssay(view.file.path, content);
        new Notice(`Published: ${url}`, 8000);
      } catch (error) {
        new Notice(`Publish failed: ${error.message}`, 10000);
      } finally {
        busy = false;
        refresh();
      }
    };

    const unpublish = async () => {
      if (busy) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) {
        new Notice('Open a note to unpublish it.');
        return;
      }
      busy = true;
      new Notice('Unpublishing essay…');
      try {
        await unpublishEssay(view.file.path);
        new Notice('Essay unpublished. The vault note is unchanged.');
      } catch (error) {
        new Notice(`Unpublish failed: ${error.message}`, 10000);
      } finally {
        busy = false;
        refresh();
      }
    };

    this.addRibbonIcon('upload', 'Publish active essay', publish);
    unpublishIcon = this.addRibbonIcon('cloud-off', 'Unpublish active essay', unpublish);
    unpublishIcon.style.display = 'none';
    this.addCommand({ id: 'publish-active-essay', name: 'Publish active essay', callback: publish });
    this.addCommand({ id: 'unpublish-active-essay', name: 'Unpublish active essay', callback: unpublish });
    this.registerEvent(this.app.workspace.on('file-open', refresh));
    this.registerEvent(this.app.workspace.on('active-leaf-change', refresh));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      moveNote(oldPath, file.path).then(refresh).catch(error => new Notice(`Essay link: ${error.message}`));
    }));
    this.app.workspace.onLayoutReady(refresh);
  }
};
