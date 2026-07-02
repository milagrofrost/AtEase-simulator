use crate::paths;
use anyhow::Result;
use serde::Deserialize;
use std::{collections::HashMap, fs, path::PathBuf};

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct Config {
    pub app: AppConfig,
    pub display: DisplayConfig,
    pub theme: ThemeConfig,
    pub folder: FolderConfig,
    pub items: HashMap<String, Vec<ItemConfig>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub title: String,
    pub startup_tab: String,
    pub fullscreen: bool,
    pub click_sound: bool,
    pub terminal_command: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct DisplayConfig {
    pub base_width: u32,
    pub base_height: u32,
    pub safe_area: SafeArea,
    pub scale_mode: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct SafeArea {
    pub left: u32,
    pub top: u32,
    pub right: u32,
    pub bottom: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct ThemeConfig {
    pub name: String,
    pub path: String,
    pub desktop_tile: String,
    pub folder_tile: String,
    pub tab_tile: String,
    pub click_sound: String,
    pub font_family: String,
    pub icon_size: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct FolderConfig {
    pub title: String,
    pub tabs: Vec<TabConfig>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct TabConfig {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ItemConfig {
    pub id: String,
    pub slot: u8,
    pub desktop_file: String,
    pub label: Option<String>,
    pub icon: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        let mut items = HashMap::new();
        items.insert(
            "main".to_string(),
            vec![ItemConfig {
                id: "terminal".to_string(),
                slot: 0,
                desktop_file: "~/.local/share/atease/apps/terminal.desktop".to_string(),
                label: Some("Terminal".to_string()),
                icon: None,
            }],
        );
        items.insert("restore".to_string(), Vec::new());
        items.insert("parents".to_string(), Vec::new());

        Self {
            app: AppConfig::default(),
            display: DisplayConfig::default(),
            theme: ThemeConfig::default(),
            folder: FolderConfig::default(),
            items,
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            title: "AtEase".to_string(),
            startup_tab: "main".to_string(),
            fullscreen: true,
            click_sound: true,
            terminal_command: "x-terminal-emulator -e".to_string(),
        }
    }
}

impl Default for DisplayConfig {
    fn default() -> Self {
        Self {
            base_width: 640,
            base_height: 480,
            safe_area: SafeArea::default(),
            scale_mode: "fit".to_string(),
        }
    }
}

impl Default for SafeArea {
    fn default() -> Self {
        Self {
            left: 72,
            top: 38,
            right: 24,
            bottom: 34,
        }
    }
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            name: "platinum".to_string(),
            path: "~/.local/share/atease/themes/platinum".to_string(),
            desktop_tile: "desktop-tile.png".to_string(),
            folder_tile: "folder-tile.png".to_string(),
            tab_tile: "tab-tile.png".to_string(),
            click_sound: "click.wav".to_string(),
            font_family: "ChicagoFLF, Charcoal, sans-serif".to_string(),
            icon_size: 42,
        }
    }
}

impl Default for FolderConfig {
    fn default() -> Self {
        Self {
            title: "PiForma Items".to_string(),
            tabs: vec![
                TabConfig {
                    id: "main".to_string(),
                    label: "At Ease Items".to_string(),
                },
                TabConfig {
                    id: "restore".to_string(),
                    label: "Restore CD".to_string(),
                },
                TabConfig {
                    id: "parents".to_string(),
                    label: "Parents".to_string(),
                },
            ],
        }
    }
}

pub fn load_config() -> Result<Config> {
    ensure_default_files()?;
    let raw = fs::read_to_string(paths::config_path()?)?;
    Ok(serde_yaml::from_str(&raw)?)
}

pub fn ensure_default_files() -> Result<()> {
    let config_path = paths::config_path()?;
    let data_dir = paths::data_dir()?;
    for dir in [
        data_dir.join("apps"),
        data_dir.join("icons"),
        data_dir.join("themes").join("platinum"),
        data_dir.join("sounds"),
    ] {
        fs::create_dir_all(dir)?;
    }

    if !config_path.exists() {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&config_path, default_config_yaml())?;
    }

    write_if_missing(data_dir.join("apps").join("terminal.desktop"), TERMINAL_DESKTOP)?;
    write_if_missing(data_dir.join("apps").join("about-piforma.desktop"), ABOUT_DESKTOP)?;
    Ok(())
}

fn write_if_missing(path: PathBuf, contents: &str) -> Result<()> {
    if !path.exists() {
        fs::write(path, contents)?;
    }
    Ok(())
}

fn default_config_yaml() -> &'static str {
    include_str!("../../examples/config.yaml")
}

const TERMINAL_DESKTOP: &str = include_str!("../../examples/apps/terminal.desktop");
const ABOUT_DESKTOP: &str = include_str!("../../examples/apps/about-piforma.desktop");
