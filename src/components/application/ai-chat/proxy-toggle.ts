/**
 * Network-proxy footer helpers.
 *
 * Kept out of `ai-chat-composer.tsx` (non-component exports break Fast
 * Refresh) and free of React so the decision rule is unit-testable on its own.
 */

/**
 * Mirrors `validate_proxy_settings` in src-tauri/src/proxy.rs: enabling the
 * proxy requires a configured URL with an http(s)/socks5 scheme and a host.
 * Disabling never fails validation, so an enabled toggle stays operable even
 * if the stored URL is later broken.
 */
function isUsableProxyUrl(value: string | null): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  const scheme = parsed.protocol.replace(":", "");
  return (
    ["http", "https", "socks5", "socks5h"].includes(scheme) &&
    parsed.hostname.length > 0
  );
}

export type ProxyQuickToggleState = { enabled: boolean; url: string | null };

/** Decide whether an unconfigured footer glyph should open proxy settings. */
export function getProxyQuickToggleAction(state: ProxyQuickToggleState): "settings" | "toggle" {
  if (!state.enabled && !isUsableProxyUrl(state.url)) return "settings";
  return "toggle";
}
