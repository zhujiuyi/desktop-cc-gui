import { IS_WINDOWS } from "@/lib/platform";

/**
 * Rendered-preview URL for a local file, backed by the app's own
 * `ccgui-preview` protocol (src-tauri/src/preview_protocol.rs).
 *
 * The asset protocol cannot serve a page that references sibling files: it
 * encodes a whole absolute path into a single URL segment
 * (`asset://localhost/%2FUsers%2F…%2Findex.html`), so `draft.css` resolves
 * against `/` and 404s. Here every path segment is encoded while the slashes
 * stay real, which gives the browser the directory structure it needs to
 * resolve relative stylesheets, scripts and images like any web page.
 *
 * Desktop only — the preview tab is not offered in web-access mode.
 */
export function previewFileUrl(path: string): string {
  const origin = IS_WINDOWS
    ? "http://ccgui-preview.localhost"
    : "ccgui-preview://localhost";
  const encoded = path
    .replace(/\\/g, "/")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  // POSIX paths keep their leading slash through the split; a Windows drive
  // path (`C:/…`) does not, and still needs the separator after the origin.
  const pathname = encoded.startsWith("/") ? encoded : `/${encoded}`;
  return `${origin}${pathname}`;
}
