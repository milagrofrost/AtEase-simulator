use crate::{config::ThemeConfig, desktop_file::DesktopEntry, paths};
use anyhow::Result;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn resolve_icon(
    configured_icon: Option<&str>,
    entry: Option<&DesktopEntry>,
    theme: &ThemeConfig,
) -> Result<String> {
    if let Some(icon) = configured_icon {
        let path = paths::expand_tilde(icon)?;
        if path.exists() {
            return Ok(paths::path_to_asset_url(&path));
        }
    }

    if let Some(icon) = entry.and_then(|entry| entry.icon.as_deref()) {
        let path = PathBuf::from(icon);
        if path.is_absolute() && path.exists() {
            return Ok(paths::path_to_asset_url(&path));
        }

        if let Some(path) = find_icon_by_name(icon) {
            return Ok(paths::path_to_asset_url(&path));
        }
    }

    let theme_missing = paths::expand_tilde(&theme.path)?.join("missing.png");
    if theme_missing.exists() {
        return Ok(paths::path_to_asset_url(&theme_missing));
    }

    Ok("/icons/missing.png".to_string())
}

fn find_icon_by_name(icon_name: &str) -> Option<PathBuf> {
    let name_path = Path::new(icon_name);
    let stem = name_path.file_stem()?.to_string_lossy();
    let extensions = ["png", "svg", "xpm"];
    let roots = icon_roots();

    for extension in extensions {
        let file_name = format!("{stem}.{extension}");
        for root in &roots {
            if root.ends_with("pixmaps") {
                let candidate = root.join(&file_name);
                if candidate.exists() {
                    return Some(candidate);
                }
            }

            if root.exists() {
                for entry in WalkDir::new(root)
                    .max_depth(5)
                    .follow_links(true)
                    .into_iter()
                    .filter_map(Result::ok)
                {
                    if entry.file_type().is_file() && entry.file_name() == file_name.as_str() {
                        return Some(entry.path().to_path_buf());
                    }
                }
            }
        }
    }

    None
}

fn icon_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".local").join("share").join("icons"));
    }
    roots.push(PathBuf::from("/usr/share/icons"));
    roots.push(PathBuf::from("/usr/share/pixmaps"));
    roots
}
