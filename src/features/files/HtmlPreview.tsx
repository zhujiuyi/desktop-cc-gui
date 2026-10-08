import { previewFileUrl } from "@/lib/preview-url";

/** Sandbox flags for a rendered local page: scripts / forms / modals run
 *  (design drafts need them), and the frame keeps its own origin so its
 *  module scripts and sibling fetches stay same-origin. That origin is
 *  still a different one from the app's, so the page cannot reach CC GUI
 *  state; top-level navigation and popups stay blocked either way. */
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-modals";

/**
 * Rendered preview of an HTML file: an iframe over the app's own
 * `ccgui-preview` protocol (src-tauri/src/preview_protocol.rs), whose URLs
 * carry the file's real directory structure — relative references
 * (`draft.css` next to `index.html`) resolve exactly as they do when the file
 * is opened in a browser. The asset protocol cannot do that: it packs the
 * whole path into one URL segment, so every sibling request 404s.
 *
 * Desktop only — EditorPane renders this only where `fileUrl` serves real
 * paths. `reloadKey` remounts the frame; that is the whole reload mechanism
 * (the document is read from disk by the frame itself, not from the store,
 * so it always shows the saved file, not an unsaved draft).
 *
 * A hidden tab renders none of this: the page's own rAF loops and timers are
 * background work and must stop when the preview is not on screen. Switching
 * back reloads it from disk — a rendered file has no in-page state worth
 * preserving (the code editor keeps its draft because a draft is editable).
 */
export function HtmlPreview({
  path,
  name,
  reloadKey,
  active,
}: {
  path: string;
  name: string;
  reloadKey: number;
  /** False while the tab is hidden — the frame is not mounted then. */
  active: boolean;
}) {
  if (!active) return null;
  return (
    <iframe
      key={reloadKey}
      src={previewFileUrl(path)}
      title={name}
      sandbox={SANDBOX}
      className="min-h-0 w-full flex-1 border-0"
    />
  );
}
