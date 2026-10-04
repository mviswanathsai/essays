const { Plugin, MarkdownView, Notice } = require('obsidian');
const { publishEssay, moveNote } = require('./publish');

module.exports = class EssayPublisher extends Plugin {
  async onload() {
    let busy = false;
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
      }
    };

    this.addRibbonIcon('upload', 'Publish active essay', publish);
    this.addCommand({ id: 'publish-active-essay', name: 'Publish active essay', callback: publish });
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      moveNote(oldPath, file.path).catch(error => new Notice(`Essay link: ${error.message}`));
    }));
  }
};
