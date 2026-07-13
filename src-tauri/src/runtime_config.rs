use crate::paths;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

const CONFIG_FILE_NAME: &str = "config.yaml";
const DEFAULT_LEFT: i32 = 71;
const DEFAULT_TOP: i32 = 0;
const DEFAULT_WIDTH: u32 = 673;
const DEFAULT_HEIGHT: u32 = 480;
const DEFAULT_SCALE: f64 = 1.0;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct RuntimeConfig {
    pub render: RenderConfig,
    pub window: WindowConfig,
    pub folders: Vec<FolderTabConfig>,
    pub startup_folder: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct FolderTabConfig {
    pub id: String,
    pub label: String,
    pub hue: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct RenderConfig {
    pub left: i32,
    pub top: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct WindowConfig {
    pub always_on_bottom: bool,
    pub skip_taskbar: bool,
    pub ignore_work_area: bool,
    pub corner_radius: u32,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            render: RenderConfig::default(),
            window: WindowConfig::default(),
            folders: vec![
                FolderTabConfig {
                    id: "main".to_string(),
                    label: "At Ease Items".to_string(),
                    hue: 0,
                },
                FolderTabConfig {
                    id: "second".to_string(),
                    label: "Nathan".to_string(),
                    hue: -128,
                },
            ],
            startup_folder: "main".to_string(),
        }
    }
}

impl Default for FolderTabConfig {
    fn default() -> Self {
        Self {
            id: String::new(),
            label: "Folder".to_string(),
            hue: 0,
        }
    }
}

impl Default for RenderConfig {
    fn default() -> Self {
        Self {
            left: DEFAULT_LEFT,
            top: DEFAULT_TOP,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            scale: DEFAULT_SCALE,
        }
    }
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            always_on_bottom: true,
            skip_taskbar: true,
            ignore_work_area: true,
            corner_radius: 6,
        }
    }
}

impl RenderConfig {
    pub fn scaled_width(&self) -> u32 {
        scaled_dimension(self.width, self.scale)
    }

    pub fn scaled_height(&self) -> u32 {
        scaled_dimension(self.height, self.scale)
    }
}

pub fn config_path() -> Result<PathBuf> {
    Ok(paths::data_dir()?.join(CONFIG_FILE_NAME))
}

pub fn load_or_create_config() -> Result<RuntimeConfig> {
    let path = config_path()?;
    if !path.exists() {
        let config = RuntimeConfig::default();
        write_config(&path, &config)?;
        return Ok(config);
    }

    let content =
        fs::read_to_string(&path).with_context(|| format!("could not read {}", path.display()))?;
    let mut config = serde_yaml::from_str::<RuntimeConfig>(&content)
        .with_context(|| format!("could not parse {}", path.display()))?;

    normalize_folders(&mut config);
    Ok(config)
}

fn normalize_folders(config: &mut RuntimeConfig) {
    config.folders.retain(|folder| !folder.id.trim().is_empty());
    config.folders.truncate(5);

    if config.folders.is_empty() {
        config.folders.push(FolderTabConfig {
            id: "main".to_string(),
            label: "At Ease Items".to_string(),
            hue: 0,
        });
    }

    if !config
        .folders
        .iter()
        .any(|folder| folder.id == config.startup_folder)
    {
        config.startup_folder = config.folders[0].id.clone();
    }
}

fn write_config(path: &PathBuf, config: &RuntimeConfig) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_yaml::to_string(config)?;
    fs::write(path, content).with_context(|| format!("could not write {}", path.display()))
}

fn scaled_dimension(value: u32, scale: f64) -> u32 {
    let safe_scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        DEFAULT_SCALE
    };
    ((value as f64) * safe_scale)
        .round()
        .clamp(1.0, u32::MAX as f64) as u32
}
