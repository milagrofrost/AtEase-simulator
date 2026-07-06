#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="atease"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo \
    ATEASE_USER="${ATEASE_USER:-${USER}}" \
    ATEASE_BINARY="${ATEASE_BINARY:-}" \
    ATEASE_DISPLAY="${ATEASE_DISPLAY:-}" \
    ATEASE_XAUTHORITY="${ATEASE_XAUTHORITY:-}" \
    "$0" "$@"
fi

TARGET_USER="${ATEASE_USER:-${SUDO_USER:-}}"
if [[ -z "${TARGET_USER}" || "${TARGET_USER}" == "root" ]]; then
  echo "Set ATEASE_USER to the desktop user that should run AtEase." >&2
  exit 1
fi

USER_HOME="$(getent passwd "${TARGET_USER}" | cut -d: -f6)"
USER_ID="$(id -u "${TARGET_USER}")"

if [[ -z "${USER_HOME}" || -z "${USER_ID}" ]]; then
  echo "Could not resolve user '${TARGET_USER}'." >&2
  exit 1
fi

BINARY="${ATEASE_BINARY:-$(command -v atease || true)}"
if [[ -z "${BINARY}" && -x "/usr/bin/atease" ]]; then
  BINARY="/usr/bin/atease"
fi

if [[ -z "${BINARY}" || ! -x "${BINARY}" ]]; then
  echo "Could not find an executable 'atease' binary. Set ATEASE_BINARY=/path/to/atease." >&2
  exit 1
fi

DISPLAY_VALUE="${ATEASE_DISPLAY:-:0}"
XAUTHORITY_VALUE="${ATEASE_XAUTHORITY:-${USER_HOME}/.Xauthority}"

install -d -m 0755 /etc/systemd/system

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=AtEase launcher shell
After=display-manager.service graphical.target
Wants=graphical.target

[Service]
Type=simple
User=${TARGET_USER}
Group=${TARGET_USER}
Environment=DISPLAY=${DISPLAY_VALUE}
Environment=XAUTHORITY=${XAUTHORITY_VALUE}
Environment=XDG_RUNTIME_DIR=/run/user/${USER_ID}
ExecStart=${BINARY}
Restart=on-failure
RestartSec=2

[Install]
WantedBy=graphical.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

echo "Installed and started ${SERVICE_NAME}.service"
echo "Check status with: systemctl status ${SERVICE_NAME}.service"
