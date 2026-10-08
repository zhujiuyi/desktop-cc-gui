//! `ccgui-preview://` — file protocol behind the HTML preview tab.
//!
//! Tauri's asset protocol encodes a whole absolute path into a single URL
//! segment (`asset://localhost/%2FUsers%2F…%2Findex.html`), so a document
//! served through it has no directory structure left to resolve against:
//! every relative reference (`draft.css`, `<script src="draft.js">`) collapses
//! to `asset://localhost/draft.css` and 404s while the document itself renders
//! unstyled. This protocol keeps the real path shape — one encoded segment per
//! path segment — so relative references resolve exactly as they do when the
//! file is opened in a browser.
//!
//! Access is the asset protocol's own scope (`$HOME/**` minus the deny list,
//! `scope.is_allowed` canonicalizes and follows symlinks across platforms),
//! so the preview can reach the same files the chat image preview already can
//! and nothing more. The frontend builds URLs in `src/lib/preview-url.ts`;
//! CSP needs `frame-src ccgui-preview: http://ccgui-preview.localhost`.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;

use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::{Manager, Runtime};

/// Scheme name; Windows maps custom protocols to `http://<name>.localhost`.
pub const PROTOCOL: &str = "ccgui-preview";

fn hex_digit(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/// Decode one `%XX`-escaped URL segment. A decoded `/`, `\`, NUL or dot
/// segment would change the path structure the browser resolved against —
/// reject it instead of silently retargeting the request at another file.
fn decode_segment(segment: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(segment.len());
    let mut input = segment.bytes();
    while let Some(byte) = input.next() {
        if byte == b'%' {
            let high = hex_digit(input.next()?)?;
            let low = hex_digit(input.next()?)?;
            bytes.push(high * 16 + low);
        } else {
            bytes.push(byte);
        }
    }
    let decoded = String::from_utf8(bytes).ok()?;
    if decoded.is_empty()
        || decoded.contains(['/', '\\', '\0'])
        || matches!(decoded.as_str(), "." | "..")
    {
        return None;
    }
    Some(decoded)
}

/// URI path → absolute filesystem path. `/Users/a%20b/x.html` becomes
/// `/Users/a b/x.html`; on Windows `/C:/x/y.html` keeps its drive prefix
/// (`C:/x/y.html`, which Windows treats as absolute).
fn parse_path(uri_path: &str) -> Option<PathBuf> {
    let raw = uri_path.strip_prefix('/')?;
    let mut segments = Vec::new();
    for segment in raw.split('/') {
        segments.push(decode_segment(segment)?);
    }
    let joined = segments.join("/");
    let bytes = joined.as_bytes();
    let is_drive_path = bytes.len() > 1 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':';
    Some(PathBuf::from(if is_drive_path {
        joined
    } else {
        format!("/{joined}")
    }))
}

/// Single-range request (`bytes=0-99`, `bytes=100-`, `bytes=-50`). Multi-range
/// requests are ignored — serving the full body is a legal answer and rallying
/// a multipart body buys nothing for HTML drafts.
fn parse_single_range(value: &str, len: u64) -> Option<(u64, u64)> {
    if len == 0 {
        return None;
    }
    let spec = value.strip_prefix("bytes=")?;
    if spec.contains(',') {
        return None;
    }
    let (start, end) = spec.trim().split_once('-')?;
    if start.is_empty() {
        let suffix: u64 = end.trim().parse().ok()?;
        if suffix == 0 {
            return None;
        }
        return Some((len.saturating_sub(suffix), len - 1));
    }
    let start: u64 = start.trim().parse().ok()?;
    if start >= len {
        return None;
    }
    let end = match end.trim() {
        "" => len - 1,
        end => end.parse::<u64>().ok()?.min(len - 1),
    };
    (end >= start).then_some((start, end))
}

fn response(status: StatusCode, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "null")
        .header(header::CACHE_CONTROL, "no-store")
        .body(body)
        .expect("static preview response")
}

fn error_response(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    eprintln!("[preview] {message}");
    response(status, message.as_bytes().to_vec())
}

fn handle<F: Fn(&std::path::Path) -> bool>(
    request: &Request<Vec<u8>>,
    is_allowed: F,
) -> Response<Vec<u8>> {
    let Some(path) = parse_path(request.uri().path()) else {
        return error_response(StatusCode::BAD_REQUEST, "invalid preview path");
    };
    if !is_allowed(&path) {
        return error_response(
            StatusCode::FORBIDDEN,
            &format!("preview path not in scope: {}", path.display()),
        );
    }

    let mut file = match File::open(&path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return error_response(
                StatusCode::NOT_FOUND,
                &format!("preview file not found: {}", path.display()),
            );
        }
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
            return error_response(
                StatusCode::FORBIDDEN,
                &format!("preview file not readable: {}", path.display()),
            );
        }
        Err(error) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("preview open failed for {}: {error}", path.display()),
            );
        }
    };
    let len = file.metadata().map(|meta| meta.len()).unwrap_or(0);
    // Extension decides first (`.css` must not sniff as text/plain), magic
    // bytes are the fallback for extension-less files.
    let mime = {
        let mut magic = vec![0_u8; len.min(8192) as usize];
        let read = file.read(&mut magic).unwrap_or(0);
        magic.truncate(read);
        let _ = file.rewind();
        tauri::utils::mime_type::MimeType::parse(&magic, &path.to_string_lossy())
    };

    let builder = Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCEPT_RANGES, "bytes")
        // Drafts are edited and refreshed in place; never replay a stale copy.
        .header(header::CACHE_CONTROL, "no-store")
        // The frame is sandboxed (opaque origin ⇒ `null`): module scripts and
        // `fetch()` in the draft need this, remote pages (a real origin) do
        // not match it and stay blocked.
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "null");

    if request.method() == Method::HEAD {
        return builder
            .header(header::CONTENT_LENGTH, len)
            .body(Vec::new())
            .expect("static preview response");
    }

    let requested_range = request
        .headers()
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| parse_single_range(value, len));
    if let Some((start, end)) = requested_range {
        let nbytes = end + 1 - start;
        let mut buffer = Vec::with_capacity(nbytes as usize);
        if file.seek(SeekFrom::Start(start)).is_err()
            || file.take(nbytes).read_to_end(&mut buffer).is_err()
        {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "preview range read failed",
            );
        }
        return builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}"))
            .header(header::CONTENT_LENGTH, nbytes)
            .body(buffer)
            .expect("static preview response");
    }

    let mut buffer = Vec::with_capacity(len as usize);
    if file.read_to_end(&mut buffer).is_err() {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, "preview read failed");
    }
    builder
        .header(header::CONTENT_LENGTH, len)
        .body(buffer)
        .expect("static preview response")
}

pub(crate) fn register<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.register_asynchronous_uri_scheme_protocol(PROTOCOL, |context, request, responder| {
        let scope = context.app_handle().asset_protocol_scope();
        // Off the webview thread: file reads are blocking, and drafts can pull
        // in media along with their stylesheets.
        tauri::async_runtime::spawn(async move {
            let response = handle(&request, |path| scope.is_allowed(path));
            responder.respond(response);
        });
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn get(uri_path: &str) -> Request<Vec<u8>> {
        Request::builder()
            .method(Method::GET)
            .uri(uri_path)
            .body(Vec::new())
            .unwrap()
    }

    /// The frontend contract in one helper: slashes stay real, everything else
    /// in a segment is percent-encoded (`encodeURIComponent` per segment).
    fn encode_uri_path(path: &str) -> String {
        let mut out = String::new();
        for byte in path.bytes() {
            let safe =
                byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'-' | b'_' | b'.' | b'~');
            if safe {
                out.push(byte as char);
            } else {
                out.push_str(&format!("%{byte:02X}"));
            }
        }
        out
    }

    fn any_path(_path: &Path) -> bool {
        true
    }

    #[test]
    fn keeps_real_path_structure() {
        assert_eq!(
            parse_path("/Users/a/index.html"),
            Some(PathBuf::from("/Users/a/index.html"))
        );
        assert_eq!(
            parse_path("/Users/a%20b/%E4%B8%AD%E6%96%87/index.html"),
            Some(PathBuf::from("/Users/a b/中文/index.html"))
        );
        // Sibling resources resolve through the very same shape.
        assert_eq!(
            parse_path("/Users/a/draft.css"),
            Some(PathBuf::from("/Users/a/draft.css"))
        );
        // Windows drive URLs keep the prefix Windows needs.
        assert_eq!(
            parse_path("/C:/x/y/index.html"),
            Some(PathBuf::from("C:/x/y/index.html"))
        );
        assert_eq!(
            parse_path("/C%3A/x/y.css"),
            Some(PathBuf::from("C:/x/y.css"))
        );
    }

    #[test]
    fn rejects_paths_that_would_escape_the_directory() {
        for uri_path in [
            "",
            "/",
            "/a/../b",
            "/a/%2E%2E/b",
            "/a/%2f b",
            "/a/b%2Fc",
            "/a/b%5Cc",
            "/a/b%00c",
            "/a//b",
            "/a/./b",
            "/%zz",
            "/a/%",
            "/a/%4",
        ] {
            assert_eq!(parse_path(uri_path), None, "accepted {uri_path}");
        }
    }

    #[test]
    fn serves_single_ranges_only() {
        assert_eq!(parse_single_range("bytes=0-99", 1000), Some((0, 99)));
        assert_eq!(parse_single_range("bytes=100-", 1000), Some((100, 999)));
        assert_eq!(parse_single_range("bytes=-50", 1000), Some((950, 999)));
        // Clamped to the file, and multi-range falls back to a full body.
        assert_eq!(parse_single_range("bytes=900-2000", 1000), Some((900, 999)));
        assert_eq!(parse_single_range("bytes=0-1,5-6", 1000), None);
        assert_eq!(parse_single_range("bytes=-0", 1000), None);
        assert_eq!(parse_single_range("bytes=5-3", 1000), None);
        assert_eq!(parse_single_range("bytes=1000-", 1000), None);
        assert_eq!(parse_single_range("items=0-1", 1000), None);
        assert_eq!(parse_single_range("bytes=0-10", 0), None);
    }

    #[test]
    fn serves_a_document_and_its_siblings_from_one_directory() {
        // A directory with a space is the point: the document URL keeps real
        // segments (unlike the asset protocol's single encoded segment), so
        // the sibling a browser would ask for next is resolvable too.
        let dir = std::env::temp_dir().join("ccgui preview protocol test");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("index.html"),
            "<link rel=stylesheet href=draft.css>",
        )
        .unwrap();
        std::fs::write(dir.join("draft.css"), ".x{color:red}").unwrap();
        let base = format!("/{}", dir.to_string_lossy().replace('\\', "/").trim_start_matches('/'));
        let scope = |path: &Path| path.starts_with(&dir);

        let document = handle(&get(&encode_uri_path(&format!("{base}/index.html"))), scope);
        assert_eq!(document.status(), StatusCode::OK);
        assert_eq!(document.headers()[header::CONTENT_TYPE], "text/html");
        assert!(String::from_utf8(document.into_body())
            .unwrap()
            .contains("draft.css"));

        // The relative reference the document makes, resolved against the
        // document URL exactly as a browser would.
        let sibling = handle(&get(&encode_uri_path(&format!("{base}/draft.css"))), scope);
        assert_eq!(sibling.status(), StatusCode::OK);
        assert_eq!(sibling.headers()[header::CONTENT_TYPE], "text/css");
        assert_eq!(sibling.into_body(), b".x{color:red}");

        assert_eq!(
            handle(
                &get(&encode_uri_path(&format!("{base}/missing.css"))),
                scope
            )
            .status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            handle(&get("/etc/hosts"), scope).status(),
            StatusCode::FORBIDDEN
        );
    }

    #[test]
    fn answers_head_and_ranges_without_a_body_where_expected() {
        let dir = std::env::temp_dir().join("ccgui preview range test");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("draft.js"), "0123456789").unwrap();
        let base = format!("/{}", dir.to_string_lossy().replace('\\', "/").trim_start_matches('/'));

        let head = Request::builder()
            .method(Method::HEAD)
            .uri(encode_uri_path(&format!("{base}/draft.js")))
            .body(Vec::new())
            .unwrap();
        let response = handle(&head, any_path);
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CONTENT_LENGTH], "10");
        assert!(response.into_body().is_empty());

        let ranged = Request::builder()
            .method(Method::GET)
            .uri(encode_uri_path(&format!("{base}/draft.js")))
            .header(header::RANGE, "bytes=2-4")
            .body(Vec::new())
            .unwrap();
        let response = handle(&ranged, any_path);
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.headers()[header::CONTENT_RANGE], "bytes 2-4/10");
        assert_eq!(response.into_body(), b"234");
    }
}
