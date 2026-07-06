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

export function launchDesktopApp(appId: string): Promise<void> {
  if (!isTauriRuntime()) {
    console.info(`AtEase preview launch: ${appId}`);
    return Promise.resolve();
  }

  return invoke<void>("launch_desktop_app", { appId });
}
