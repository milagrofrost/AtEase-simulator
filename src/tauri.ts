import { invoke } from "@tauri-apps/api/core";

export interface DesktopAppsModel {
  apps: DesktopAppModel[];
  message: string | null;
}

export interface DesktopAppModel {
  id: string;
  name: string;
  comment: string | null;
  iconUrl: string;
  slot: number;
  disabled: boolean;
  error: string | null;
}

export interface RuntimeConfig {
  render: RenderConfig;
  window: WindowConfig;
  folders: FolderTabConfig[];
  startup_folder: string;
}

export interface FolderTabConfig {
  id: string;
  label: string;
  hue: number;
}

export interface RenderConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

export interface WindowConfig {
  always_on_bottom: boolean;
  skip_taskbar: boolean;
  ignore_work_area: boolean;
  corner_radius: number;
}

const previewModel: DesktopAppsModel = {
  apps: [
    previewApp("dos", "DOS Compatibility", 0, "/icons/preview/dos.svg"),
    previewApp("tips", "Helpful Tips", 1, "/icons/preview/mac.svg"),
    previewApp("phone", "Phone Numbers", 2, "/icons/preview/phone.svg"),
    previewApp("sharing", "Sharing Your Computer", 3, "/icons/preview/share.svg"),
    previewApp("simpletext", "SimpleText", 4, "/icons/preview/text.svg"),
    previewApp("support", "Support Information", 5, "/icons/preview/support.svg"),
    previewApp("whyback", "Why Back Up", 6, "/icons/preview/backup.svg"),
  ],
  message: null,
};

function previewApp(
  id: string,
  name: string,
  slot: number,
  iconUrl = "/icons/missing.png",
): DesktopAppModel {
  return {
    id,
    name,
    iconUrl,
    slot,
    disabled: false,
    error: null,
    comment: "Preview item",
  };
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function getDesktopApps(): Promise<DesktopAppsModel> {
  if (!isTauriRuntime()) {
    return Promise.resolve(previewModel);
  }

  return invoke<DesktopAppsModel>("get_desktop_apps");
}

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!isTauriRuntime()) {
    return Promise.resolve({
      render: {
        left: 71,
        top: 0,
        width: 673,
        height: 480,
        scale: 1,
      },
      window: {
        always_on_bottom: true,
        skip_taskbar: true,
        ignore_work_area: true,
        corner_radius: 6,
      },
      folders: [
        { id: "main", label: "At Ease Items", hue: 0 },
        { id: "second", label: "Nathan", hue: -128 },
      ],
      startup_folder: "main",
    });
  }

  return invoke<RuntimeConfig>("get_runtime_config");
}

export function launchDesktopApp(appId: string): Promise<void> {
  if (!isTauriRuntime()) {
    console.info(`AtEase preview launch: ${appId}`);
    return Promise.resolve();
  }

  return invoke<void>("launch_desktop_app", { appId });
}
