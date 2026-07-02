use anyhow::{anyhow, Result};
use std::{collections::HashMap, fs, path::Path};

#[derive(Debug, Clone, Default)]
pub struct DesktopEntry {
    pub name: Option<String>,
    pub exec: Option<String>,
    pub icon: Option<String>,
    pub terminal: bool,
    pub entry_type: Option<String>,
    pub no_display: bool,
    pub hidden: bool,
    pub comment: Option<String>,
}

impl DesktopEntry {
    pub fn is_application(&self) -> bool {
        self.entry_type.as_deref() == Some("Application")
    }
}

pub fn parse_desktop_file(path: &Path) -> Result<DesktopEntry> {
    let raw = fs::read_to_string(path)?;
    parse_desktop_entry(&raw)
}

pub fn parse_desktop_entry(raw: &str) -> Result<DesktopEntry> {
    let mut in_entry = false;
    let mut values = HashMap::<String, String>::new();

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_entry = trimmed == "[Desktop Entry]";
            continue;
        }

        if !in_entry {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            if !key.contains('[') {
                values.insert(key.to_string(), value.to_string());
            }
        }
    }

    if values.is_empty() {
        return Err(anyhow!("missing [Desktop Entry] section"));
    }

    Ok(DesktopEntry {
        name: values.remove("Name"),
        exec: values.remove("Exec"),
        icon: values.remove("Icon"),
        terminal: parse_bool(values.get("Terminal")),
        entry_type: values.remove("Type"),
        no_display: parse_bool(values.get("NoDisplay")),
        hidden: parse_bool(values.get("Hidden")),
        comment: values.remove("Comment"),
    })
}

fn parse_bool(value: Option<&String>) -> bool {
    value
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

pub fn clean_exec(exec: &str) -> Result<Vec<String>> {
    let mut parts = shell_words::split(exec)?;
    parts.retain(|part| !is_field_code(part));

    for part in &mut parts {
        *part = strip_embedded_field_codes(part);
    }
    parts.retain(|part| !part.is_empty());

    if parts.is_empty() {
        return Err(anyhow!("Exec line did not contain a command"));
    }

    Ok(parts)
}

fn is_field_code(part: &str) -> bool {
    matches!(part, "%f" | "%F" | "%u" | "%U" | "%i" | "%c" | "%k")
}

fn strip_embedded_field_codes(value: &str) -> String {
    let mut cleaned = value.to_string();
    for code in ["%f", "%F", "%u", "%U", "%i", "%c", "%k"] {
        cleaned = cleaned.replace(code, "");
    }
    cleaned
}
