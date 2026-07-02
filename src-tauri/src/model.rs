use crate::{config, desktop_file, icons, paths};
use anyhow::Result;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopModel {
    pub app_title: String,
    pub startup_tab: String,
    pub click_sound_enabled: bool,
    pub click_sound_url: Option<String>,
    pub display: DisplayModel,
    pub theme: ThemeModel,
    pub folder: FolderModel,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayModel {
    pub base_width: u32,
    pub base_height: u32,
    pub safe_area: SafeAreaModel,
    pub scale_mode: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeAreaModel {
    pub left: u32,
    pub top: u32,
    pub right: u32,
    pub bottom: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeModel {
    pub desktop_tile_url: String,
    pub folder_tile_url: String,
    pub tab_tile_url: String,
    pub font_family: String,
    pub icon_size: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderModel {
    pub title: String,
    pub tabs: Vec<TabModel>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabModel {
    pub id: String,
    pub label: String,
    pub items: Vec<ItemModel>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemModel {
    pub id: String,
    pub label: String,
    pub icon_url: String,
    pub slot: u8,
    pub disabled: bool,
    pub missing: bool,
    pub warning: Option<String>,
    pub comment: Option<String>,
}

pub fn build_desktop_model() -> Result<DesktopModel> {
    let cfg = config::load_config()?;
    let theme_path = paths::expand_tilde(&cfg.theme.path)?;
    let click_sound_path = theme_path.join(&cfg.theme.click_sound);
    let click_sound_url = if click_sound_path.exists() {
        Some(paths::path_to_asset_url(&click_sound_path))
    } else {
        Some("/themes/platinum/click.wav".to_string())
    };

    let tabs = cfg
        .folder
        .tabs
        .iter()
        .take(4)
        .map(|tab| {
            let items = cfg
                .items
                .get(&tab.id)
                .map(|items| {
                    items
                        .iter()
                        .filter(|item| item.slot < 16)
                        .map(|item| build_item_model(item, &cfg.theme))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            TabModel {
                id: tab.id.clone(),
                label: tab.label.clone(),
                items,
            }
        })
        .collect();

    Ok(DesktopModel {
        app_title: cfg.app.title,
        startup_tab: cfg.app.startup_tab,
        click_sound_enabled: cfg.app.click_sound,
        click_sound_url,
        display: DisplayModel {
            base_width: cfg.display.base_width,
            base_height: cfg.display.base_height,
            safe_area: SafeAreaModel {
                left: cfg.display.safe_area.left,
                top: cfg.display.safe_area.top,
                right: cfg.display.safe_area.right,
                bottom: cfg.display.safe_area.bottom,
            },
            scale_mode: cfg.display.scale_mode,
        },
        theme: ThemeModel {
            desktop_tile_url: asset_or_public(&theme_path.join(&cfg.theme.desktop_tile), "/themes/platinum/desktop-tile.png"),
            folder_tile_url: asset_or_public(&theme_path.join(&cfg.theme.folder_tile), "/themes/platinum/folder-tile.png"),
            tab_tile_url: asset_or_public(&theme_path.join(&cfg.theme.tab_tile), "/themes/platinum/tab-tile.png"),
            font_family: cfg.theme.font_family,
            icon_size: cfg.theme.icon_size,
        },
        folder: FolderModel {
            title: cfg.folder.title,
            tabs,
        },
    })
}

fn build_item_model(item: &config::ItemConfig, theme: &config::ThemeConfig) -> ItemModel {
    let desktop_path = match paths::expand_tilde(&item.desktop_file) {
        Ok(path) => path,
        Err(error) => {
            return broken_item(item, "Missing", format!("Bad desktop path: {error}"));
        }
    };

    if !desktop_path.exists() {
        return broken_item(item, "Missing", "Desktop file is missing".to_string());
    }

    if desktop_path.extension().and_then(|ext| ext.to_str()) != Some("desktop") {
        return broken_item(item, "Invalid", "Configured file is not a .desktop file".to_string());
    }

    let entry = match desktop_file::parse_desktop_file(&desktop_path) {
        Ok(entry) => entry,
        Err(error) => return broken_item(item, "Invalid", format!("Could not parse desktop file: {error}")),
    };

    let mut disabled = false;
    let mut warning = None;
    if !entry.is_application() {
        disabled = true;
        warning = Some("Desktop entry is not Type=Application".to_string());
    } else if entry.hidden {
        disabled = true;
        warning = Some("Desktop entry is Hidden=true".to_string());
    } else if entry.exec.is_none() {
        disabled = true;
        warning = Some("Desktop entry is missing Exec".to_string());
    }
    if entry.no_display {
        log::debug!("configured item {} uses NoDisplay=true and remains visible", item.id);
    }

    let label = item
        .label
        .clone()
        .or_else(|| entry.name.clone())
        .unwrap_or_else(|| item.id.clone());
    let icon_url = icons::resolve_icon(item.icon.as_deref(), Some(&entry), theme)
        .unwrap_or_else(|_| "/icons/missing.png".to_string());

    ItemModel {
        id: item.id.clone(),
        label,
        icon_url,
        slot: item.slot,
        disabled,
        missing: false,
        warning,
        comment: entry.comment,
    }
}

fn broken_item(item: &config::ItemConfig, label: &str, warning: String) -> ItemModel {
    ItemModel {
        id: item.id.clone(),
        label: item.label.clone().unwrap_or_else(|| label.to_string()),
        icon_url: "/icons/missing.png".to_string(),
        slot: item.slot,
        disabled: true,
        missing: true,
        warning: Some(warning),
        comment: None,
    }
}

fn asset_or_public(path: &PathBuf, fallback: &str) -> String {
    if path.exists() {
        paths::path_to_asset_url(path)
    } else {
        fallback.to_string()
    }
}
