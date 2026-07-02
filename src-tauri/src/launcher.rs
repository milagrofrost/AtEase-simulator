use crate::{config, desktop_file, paths};
use anyhow::{anyhow, bail, Context, Result};
use std::process::Command;

pub fn launch_item(item_id: &str) -> Result<()> {
    let cfg = config::load_config()?;
    let item = cfg
        .items
        .values()
        .flatten()
        .find(|item| item.id == item_id)
        .ok_or_else(|| anyhow!("unknown item id"))?;

    let desktop_path = paths::expand_tilde(&item.desktop_file)?;
    if !desktop_path.exists() {
        bail!("configured desktop file does not exist");
    }
    if desktop_path.extension().and_then(|ext| ext.to_str()) != Some("desktop") {
        bail!("configured launcher is not a .desktop file");
    }

    let entry = desktop_file::parse_desktop_file(&desktop_path)?;
    if !entry.is_application() {
        bail!("desktop file is not Type=Application");
    }
    if entry.hidden {
        bail!("desktop file is Hidden=true");
    }

    let exec = entry.exec.as_deref().ok_or_else(|| anyhow!("desktop file is missing Exec"))?;
    let mut argv = desktop_file::clean_exec(exec).context("invalid Exec line")?;

    if entry.terminal {
        let mut terminal = shell_words::split(&cfg.app.terminal_command)?;
        if terminal.is_empty() {
            bail!("terminal_command is empty");
        }
        terminal.append(&mut argv);
        argv = terminal;
    }

    let command = argv.remove(0);
    Command::new(command).args(argv).spawn()?;
    Ok(())
}
