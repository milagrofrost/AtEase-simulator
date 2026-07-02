# AtEase

AtEase is a lightweight Raspberry Pi/Linux launcher shell inspired by Apple At Ease and classic Mac OS 9 pseudo-folders. It is a fan-made, classic Mac-inspired launcher for Linux and is not affiliated with Apple Inc. or Apple At Ease.

AtEase is not a full desktop environment, file manager, parental-control system, policy layer, or replacement window manager. It is a kiosk-style launcher that displays configured tabs and large beveled icon buttons. Each button launches a configured Linux `.desktop` file.

## Current Scope

- Tauri app with HTML/CSS/TypeScript frontend and Rust commands.
- Fullscreen launcher window.
- Configurable safe area for bezels and panels.
- One tabbed AtEase folder with up to 4 tabs.
- 4x4 item grid per tab.
- Items are explicitly listed in YAML.
- Frontend sends only an item id to Rust.
- Rust loads config, parses `.desktop` files, validates entries, resolves icons, and launches.
- Broken or missing `.desktop` files render as disabled buttons.
- Optional click sound and tiled PNG theme assets.

## Security Boundary

AtEase does not accept arbitrary command strings from the frontend. The UI calls only:

- `get_desktop_model()`
- `launch_item(item_id)`

Launch behavior belongs in `.desktop` files or wrapper scripts referenced by `.desktop` `Exec` lines. If an app needs complex startup behavior, write a wrapper script and point the `.desktop` file at that script.

## Config

Default config path:

```text
~/.config/atease/config.yaml
```

Default data paths:

```text
~/.local/share/atease/
~/.local/share/atease/apps/
~/.local/share/atease/icons/
~/.local/share/atease/themes/
~/.local/share/atease/sounds/
```

On startup, AtEase creates the config file and data directories if they do not exist. See [examples/config.yaml](/home/frost/atEase/examples/config.yaml) for a complete example.

## .desktop Rules

AtEase launches only `.desktop` files explicitly referenced in `config.yaml`.

Validation rules:

- Path must exist.
- Path must end in `.desktop`.
- `Type` must be `Application`.
- `Hidden=true` disables the item for v1.
- `NoDisplay=true` is allowed because AtEase is curated.
- `Exec` field codes `%f`, `%F`, `%u`, `%U`, `%i`, `%c`, and `%k` are removed or ignored.
- File and URL arguments are not supported in v1.
- `Terminal=true` launches through `app.terminal_command`.

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Build:

```bash
npm run build
```

The Tauri window is configured fullscreen and undecorated by default.

## Raspberry Pi / XFCE / Openbox Notes

AtEase is intended to work well on Raspberry Pi setups using XFCE or Openbox. It can coexist with a normal panel/menu bar if configured that way, and the safe area values are designed for custom bezels or constrained displays.

For kiosk-style sessions, launch AtEase after login using your normal session autostart mechanism. In some multi-display or nested display setups, launch with the desired display environment, for example:

```bash
DISPLAY=:2 npm run dev
```

For a cleaner appliance feel in XFCE, hide desktop icons in `xfdesktop` and let AtEase provide the curated launch surface.

## Project Structure

```text
src-tauri/src/
  config.rs        YAML config loading and default file creation
  desktop_file.rs  Small .desktop parser and Exec cleanup
  icons.rs         Icon path/name resolution
  launcher.rs      Safe launch-by-item-id command
  model.rs         Sanitized frontend model
  paths.rs         Config/data paths and ~ expansion

src/
  app.ts           UI rendering and launch interaction
  config.ts        Frontend model types
  tauri.ts         Narrow command wrapper
  styles.css       Retro beveled AtEase styling
```
