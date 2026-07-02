use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};

pub fn config_path() -> Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow!("could not determine home directory"))?;
    Ok(home.join(".config").join("atease").join("config.yaml"))
}

pub fn data_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow!("could not determine home directory"))?;
    Ok(home.join(".local").join("share").join("atease"))
}

pub fn expand_tilde(input: &str) -> Result<PathBuf> {
    if input == "~" {
        return dirs::home_dir().ok_or_else(|| anyhow!("could not determine home directory"));
    }

    if let Some(rest) = input.strip_prefix("~/") {
        let home = dirs::home_dir().ok_or_else(|| anyhow!("could not determine home directory"))?;
        return Ok(home.join(rest));
    }

    Ok(PathBuf::from(input))
}

pub fn path_to_asset_url(path: &Path) -> String {
    let absolute = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    match url::Url::from_file_path(&absolute) {
        Ok(url) => url.to_string(),
        Err(_) => String::new(),
    }
}
