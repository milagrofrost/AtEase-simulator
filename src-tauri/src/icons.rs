use crate::{config::ThemeConfig, desktop_file::DesktopEntry, paths};
use anyhow::{Context, Result};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use walkdir::WalkDir;

#[allow(dead_code)]
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

pub fn resolve_desktop_icon(entry: &DesktopEntry) -> String {
    if let Some(icon) = entry
        .icon
        .as_deref()
        .map(str::trim)
        .filter(|icon| !icon.is_empty())
    {
        let path = PathBuf::from(icon);
        if path.is_absolute() && path.exists() {
            return cache_icon(&path).unwrap_or_else(|error| {
                log::warn!("could not cache desktop icon {}: {error}", path.display());
                "/icons/missing.png".to_string()
            });
        }

        if let Some(path) = find_icon_by_name(icon) {
            return cache_icon(&path).unwrap_or_else(|error| {
                log::warn!("could not cache desktop icon {}: {error}", path.display());
                "/icons/missing.png".to_string()
            });
        }
    }

    "/icons/missing.png".to_string()
}

fn cache_icon(source: &Path) -> Result<String> {
    let canonical_source = source
        .canonicalize()
        .with_context(|| format!("could not resolve icon {}", source.display()))?;
    let extension = canonical_source
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("png");
    let cache_dir = paths::data_dir()?.join("cache").join("icons");
    fs::create_dir_all(&cache_dir)?;
    let source_meta = fs::metadata(&canonical_source)?;

    let cached_path = cache_dir.join(format!(
        "{:016x}.{}",
        stable_icon_hash(&canonical_source, &source_meta),
        extension
    ));

    if !cached_path.exists() {
        fs::copy(&canonical_source, &cached_path).with_context(|| {
            format!(
                "could not copy icon {} to {}",
                canonical_source.display(),
                cached_path.display()
            )
        })?;
    }

    Ok(cached_path.to_string_lossy().into_owned())
}

fn stable_icon_hash(path: &Path, metadata: &fs::Metadata) -> u64 {
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().hash(&mut hasher);
    metadata.len().hash(&mut hasher);
    if let Ok(modified) = metadata.modified() {
        if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
            duration.as_secs().hash(&mut hasher);
            duration.subsec_nanos().hash(&mut hasher);
        }
    }
    hasher.finish()
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
    roots.push(PathBuf::from("/usr/share/pixmaps"));
    roots.push(PathBuf::from("/usr/share/icons"));
    roots
}
