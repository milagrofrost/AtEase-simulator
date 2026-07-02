mod config;
mod desktop_file;
mod icons;
mod launcher;
mod model;
mod paths;

use model::DesktopModel;

#[tauri::command]
fn get_desktop_model() -> Result<DesktopModel, String> {
    model::build_desktop_model().map_err(|error| {
        log::error!("failed to build desktop model: {error:?}");
        error.to_string()
    })
}

#[tauri::command]
fn launch_item(item_id: String) -> Result<(), String> {
    launcher::launch_item(&item_id).map_err(|error| {
        log::error!("failed to launch item {item_id}: {error:?}");
        error.to_string()
    })
}

fn main() {
    config::ensure_default_files().unwrap_or_else(|error| {
        eprintln!("AtEase could not create default config files: {error:?}");
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_desktop_model, launch_item])
        .run(tauri::generate_context!())
        .expect("failed to run AtEase");
}
