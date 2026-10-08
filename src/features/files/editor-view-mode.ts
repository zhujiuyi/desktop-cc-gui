/**
 * Which open files get a rendered preview in the editor tab, and the mode
 * they open with. Markdown has its own renderer (MarkdownPreview); HTML
 * renders through HtmlPreview, which needs the desktop `ccgui-preview`
 * protocol — the web-access mode has no equivalent, so there HTML keeps the
 * code view.
 */

export type EditorViewMode = "edit" | "preview";

const MARKDOWN_RE = /\.(?:md|markdown)$/i;
const HTML_RE = /\.(?:html?|xhtml)$/i;

/** Markdown preview is available on every platform. */
export function isMarkdownFile(name: string): boolean {
  return MARKDOWN_RE.test(name);
}

/** HTML file, before the platform gate — see `opensInPreview`. */
export function isHtmlFile(name: string): boolean {
  return HTML_RE.test(name);
}

/** Whether the file opens with a rendered preview: Markdown always, HTML
 *  only where the preview protocol serves real paths (desktop). */
export function opensInPreview(name: string, hasFilePreviews: boolean): boolean {
  return isMarkdownFile(name) || (hasFilePreviews && isHtmlFile(name));
}
