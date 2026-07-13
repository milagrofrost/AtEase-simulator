#[allow(dead_code)]
mod config;
mod desktop_apps;
mod desktop_file;
mod icons;
#[allow(dead_code)]
mod launcher;
#[allow(dead_code)]
mod model;
mod paths;
mod runtime_config;

use desktop_apps::DesktopAppsModel;
use gtk::prelude::*;
use runtime_config::RuntimeConfig;
use std::process::Command;
use tauri::{path::BaseDirectory, AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[tauri::command]
fn get_desktop_apps(folder_id: Option<String>) -> Result<DesktopAppsModel, String> {
    desktop_apps::get_desktop_apps(folder_id.as_deref()).map_err(|error| {
        log::error!("failed to get desktop apps for folder {folder_id:?}: {error:?}");
        error.to_string()
    })
}

#[tauri::command]
fn get_runtime_config() -> Result<RuntimeConfig, String> {
    runtime_config::load_or_create_config().map_err(|error| {
        log::error!("failed to load runtime config: {error:?}");
        error.to_string()
    })
}

#[tauri::command]
fn launch_desktop_app(app_id: String) -> Result<(), String> {
    desktop_apps::launch_desktop_app(&app_id).map_err(|error| {
        log::error!("failed to launch desktop app {app_id}: {error:?}");
        error.to_string()
    })
}

#[tauri::command]
fn play_click_sound(app: AppHandle) -> Result<(), String> {
    let sound_path = app
        .path()
        .resolve("sounds/click.wav", BaseDirectory::Resource)
        .map_err(|error| {
            log::error!("failed to resolve click sound resource: {error:?}");
            error.to_string()
        })?;

    log::info!("attempting click sound playback: {}", sound_path.display());

    if !sound_path.exists() {
        let message = format!("click sound WAV does not exist: {}", sound_path.display());
        log::warn!("{message}");
        return Err(message);
    }

    Command::new("aplay")
        .args(["-D", "pipewire"])
        .arg(&sound_path)
        .spawn()
        .map(|_| {
            log::info!("aplay click sound process started");
        })
        .map_err(|error| {
            log::error!("failed to start aplay for click sound: {error:?}");
            error.to_string()
        })
}

fn main() {
    if let Err(error) = desktop_apps::ensure_apps_dir() {
        eprintln!("AtEase could not create apps directory: {error:?}");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            apply_runtime_window_config(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_desktop_apps,
            get_runtime_config,
            launch_desktop_app,
            play_click_sound
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AtEase");
}

fn apply_runtime_window_config(app: &mut tauri::App) -> tauri::Result<()> {
    let config = runtime_config::load_or_create_config().map_err(|error| {
        log::error!("failed to load runtime config: {error:?}");
        tauri::Error::Anyhow(error)
    })?;

    if let Some(window) = app.get_webview_window("main") {
        let render = &config.render;
        if let Ok(gtk_window) = window.gtk_window() {
            gtk_window.set_type_hint(gdk::WindowTypeHint::Normal);
            gtk_window.set_skip_taskbar_hint(config.window.skip_taskbar);
            gtk_window.set_skip_pager_hint(true);
            gtk_window.set_keep_below(config.window.always_on_bottom);
            gtk_window.set_accept_focus(false);
            gtk_window.set_focus_on_map(false);
            gtk_window.stick();
        } else {
            log::warn!("could not access GTK window for desktop-level hints");
        }

        window.set_fullscreen(false)?;
        window.set_decorations(false)?;
        window.set_resizable(false)?;
        window.set_size(PhysicalSize::new(
            render.scaled_width(),
            render.scaled_height(),
        ))?;
        window.set_position(PhysicalPosition::new(render.left, render.top))?;
        window.set_skip_taskbar(config.window.skip_taskbar)?;
        window.set_always_on_top(false)?;
        window.set_focusable(false)?;
        window.show()?;
    } else {
        log::warn!("main window was not available while applying runtime config");
    }

    Ok(())
}
