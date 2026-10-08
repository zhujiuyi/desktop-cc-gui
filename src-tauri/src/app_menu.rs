//! macOS application menu.
//!
//! Tauri's automatic default menu wires ⌘W to the predefined Close Window
//! item (`performClose:`), which destroys the main window — taking every live
//! engine run with it — before the webview ever sees the keydown. The app
//! wants ⌘W to close the **tab in view** instead (shortcut action `closeTab`,
//! default ⌘W), so the default menu is rebuilt here minus that one item: with
//! no menu item claiming the key equivalent, the keydown reaches the webview
//! and the frontend shortcut runtime handles it, exactly like on
//! Windows/Linux.
//!
//! Everything else mirrors `tauri::menu::Menu::default()` so macOS keeps its
//! standard app menu (About/Quit), Edit menu (cut/copy/paste/select-all —
//! supplied natively, not by the webview) and Window menu (minimize/zoom).
//! The File menu is dropped along with its only macOS entry, Close Window.

/// Replace the automatic macOS menu with the same one minus Close Window.
/// No-op off macOS: there is no default menu to strip and Ctrl+W already
/// reaches the webview.
#[cfg(target_os = "macos")]
pub fn install(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{AboutMetadata, Menu, PredefinedMenuItem, Submenu};

    let pkg_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config.bundle.publisher.clone().map(|p| vec![p]),
        ..Default::default()
    };

    let menu = Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                pkg_info.name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "View",
                true,
                &[&PredefinedMenuItem::fullscreen(app, None)?],
            )?,
            // Deliberately no Close Window: ⌘W belongs to the tab strip.
            &Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                ],
            )?,
            &Submenu::with_items(app, "Help", true, &[])?,
        ],
    )?;
    app.set_menu(menu)?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn install(_app: &tauri::AppHandle) -> tauri::Result<()> {
    Ok(())
}
