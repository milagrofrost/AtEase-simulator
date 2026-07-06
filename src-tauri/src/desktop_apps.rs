use crate::{desktop_file, icons, paths};
use anyhow::{anyhow, bail, Context, Result};
use serde::Serialize;
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    process::Command,
};

const MAX_APPS: usize = 12;
const APPS_DIR_DISPLAY: &str = "~/.local/share/atease/apps/";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAppsModel {
    pub apps: Vec<DesktopAppModel>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAppModel {
    pub id: String,
    pub name: String,
    pub comment: Option<String>,
    pub icon_url: String,
    pub slot: u8,
    pub disabled: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct DiscoveredDesktopApp {
    model: DesktopAppModel,
    desktop_path: PathBuf,
}

pub fn ensure_apps_dir() -> Result<PathBuf> {
    let apps_dir = apps_dir()?;
    fs::create_dir_all(&apps_dir)?;
    Ok(apps_dir)
}

pub fn get_desktop_apps() -> Result<DesktopAppsModel> {
    let scan = scan_desktop_apps()?;
    Ok(DesktopAppsModel {
        apps: scan
            .apps
            .into_iter()
            .map(|app| app.model)
            .take(MAX_APPS)
            .collect(),
        message: scan.message,
    })
}

pub fn launch_desktop_app(app_id: &str) -> Result<()> {
    let scan = scan_desktop_apps()?;
    let app = scan
        .apps
        .into_iter()
        .find(|app| app.model.id == app_id)
        .ok_or_else(|| anyhow!("unknown desktop app id"))?;

    validate_desktop_path(&app.desktop_path)?;
    let entry = desktop_file::parse_desktop_file(&app.desktop_path)
        .with_context(|| format!("could not parse {}", app.desktop_path.display()))?;
    validate_entry(&entry)?;

    launch_with_helper(&app.desktop_path)
}

struct ScanResult {
    apps: Vec<DiscoveredDesktopApp>,
    message: Option<String>,
}

fn scan_desktop_apps() -> Result<ScanResult> {
    let apps_dir = ensure_apps_dir()?;
    let mut desktop_files = fs::read_dir(&apps_dir)?
        .filter_map(|entry| match entry {
            Ok(entry) => Some(entry.path()),
            Err(error) => {
                log::warn!(
                    "skipping unreadable entry in {}: {error}",
                    apps_dir.display()
                );
                None
            }
        })
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("desktop"))
        .collect::<Vec<_>>();

    desktop_files.sort_by(|a, b| file_name_string(a).cmp(&file_name_string(b)));

    let desktop_file_count = desktop_files.len();
    let mut apps = Vec::new();

    for desktop_path in desktop_files {
        if apps.len() >= MAX_APPS {
            break;
        }

        let file_name = file_name_string(&desktop_path);
        match parse_valid_desktop_app(&desktop_path, apps.len() as u8) {
            Ok(app) => apps.push(app),
            Err(error) => log::warn!("skipping invalid desktop app {file_name}: {error}"),
        }
    }

    let message = if apps.is_empty() {
        if desktop_file_count == 0 {
            Some(format!("No apps found in {APPS_DIR_DISPLAY}"))
        } else {
            Some(format!(
                "No valid .desktop apps found in {APPS_DIR_DISPLAY}"
            ))
        }
    } else {
        None
    };

    Ok(ScanResult { apps, message })
}

fn parse_valid_desktop_app(path: &Path, slot: u8) -> Result<DiscoveredDesktopApp> {
    validate_desktop_path(path)?;
    let entry = desktop_file::parse_desktop_file(path)
        .with_context(|| format!("could not parse {}", path.display()))?;
    validate_entry(&entry)?;
    if is_legacy_about_entry(path, &entry) {
        bail!("legacy bundled About item is not a launchable desktop app");
    }

    let name = entry.name.clone().ok_or_else(|| anyhow!("missing Name"))?;
    let icon_url = icons::resolve_desktop_icon(&entry);
    let id = desktop_app_id(path);

    Ok(DiscoveredDesktopApp {
        model: DesktopAppModel {
            id,
            name,
            comment: entry.comment,
            icon_url,
            slot,
            disabled: false,
            error: None,
        },
        desktop_path: path.to_path_buf(),
    })
}

fn validate_entry(entry: &desktop_file::DesktopEntry) -> Result<()> {
    if !entry.is_application() {
        bail!("Type must be Application");
    }
    if entry.hidden {
        bail!("Hidden=true");
    }
    if entry
        .name
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        bail!("missing Name");
    }
    if entry
        .exec
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        bail!("missing Exec");
    }
    if entry.no_display {
        log::debug!("desktop app uses NoDisplay=true and remains visible");
    }
    if entry.terminal {
        log::debug!("desktop app uses Terminal=true; launch is delegated to the desktop launcher");
    }

    Ok(())
}

fn is_legacy_about_entry(path: &Path, entry: &desktop_file::DesktopEntry) -> bool {
    file_name_string(path) == "about-piforma.desktop"
        && entry.name.as_deref() == Some("About This PiForma")
}

fn validate_desktop_path(path: &Path) -> Result<()> {
    if path.extension().and_then(|ext| ext.to_str()) != Some("desktop") {
        bail!("file does not end with .desktop");
    }

    let apps_dir = apps_dir()?.canonicalize()?;
    let canonical_path = path
        .canonicalize()
        .with_context(|| format!("desktop file does not exist: {}", path.display()))?;
    if !canonical_path.starts_with(&apps_dir) {
        bail!("desktop file is outside {}", apps_dir.display());
    }

    Ok(())
}

fn launch_with_helper(path: &Path) -> Result<()> {
    let mut failures = Vec::new();
    for helper in ["gio", "dex"] {
        let result = if helper == "gio" {
            Command::new(helper).arg("launch").arg(path).status()
        } else {
            Command::new(helper).arg(path).status()
        };

        match result {
            Ok(status) if status.success() => {
                log::info!("launched {} with {helper}", path.display());
                return Ok(());
            }
            Ok(status) => {
                let message = format!("{helper}: exited with {status}");
                log::warn!("failed to launch {} with {message}", path.display());
                failures.push(message);
            }
            Err(error) => {
                let message = format!("{helper}: {error}");
                log::warn!("failed to launch {} with {message}", path.display());
                failures.push(message);
            }
        }
    }

    bail!(
        "could not launch desktop app with gio or dex ({})",
        failures.join("; ")
    )
}

fn apps_dir() -> Result<PathBuf> {
    Ok(paths::data_dir()?.join("apps"))
}

fn desktop_app_id(path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    file_name_string(path).hash(&mut hasher);
    format!("desktop-{:016x}", hasher.finish())
}

fn file_name_string(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}
