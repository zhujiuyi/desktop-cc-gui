/**
 * DOM text-search primitives shared by in-content searches (chat timeline,
 * markdown preview). Matches are case-insensitive and non-overlapping, in
 * document order — the same contract as the browser's own find counter.
 *
 * Callers turn the node/offset pairs into Ranges: highlights go through the
 * CSS Custom Highlight API (`highlightSupported`), so rendered content is
 * never mutated and React/Streamdown caches stay valid.
 */

export interface TextMatch {
  node: Text;
  /** Character offsets into `node.nodeValue`. */
  start: number;
  end: number;
}

/** Every occurrence of `query` under `root`, walking text nodes in order.
 *  A blank query yields no matches. */
export function findTextMatches(root: Node, query: string): TextMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const doc =
    root.ownerDocument ?? (typeof document !== "undefined" ? document : null);
  if (!doc) return [];
  const matches: TextMatch[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.nodeValue ?? "";
    const lower = text.toLowerCase();
    let from = 0;
    for (;;) {
      const at = lower.indexOf(needle, from);
      if (at === -1) break;
      matches.push({ node: node as Text, start: at, end: at + needle.length });
      from = at + needle.length;
    }
    node = walker.nextNode();
  }
  return matches;
}

/** WKWebView needs Safari 17.2+, Chromium always has it. Callers fall back to
 *  count-and-scroll when unsupported. */
export function highlightSupported(): boolean {
  return (
    typeof CSS !== "undefined" &&
    "highlights" in CSS &&
    typeof Highlight !== "undefined"
  );
}
