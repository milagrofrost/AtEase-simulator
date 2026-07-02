import { invoke } from "@tauri-apps/api/core";
import type { DesktopModel } from "./config";

const previewModel: DesktopModel = {
  appTitle: "AtEase Preview",
  startupTab: "main",
  clickSoundEnabled: true,
  clickSoundUrl: "/themes/platinum/click.wav",
  display: {
    baseWidth: 640,
    baseHeight: 480,
    safeArea: {
      left: 12,
      top: 12,
      right: 12,
      bottom: 12,
    },
    scaleMode: "fit",
  },
  theme: {
    desktopTileUrl: "/themes/platinum/desktop-tile.png",
    folderTileUrl: "/themes/atease/folder-tile.png",
    tabTileUrl: "/themes/atease/folder-tile.png",
    fontFamily: "ChicagoFLF, Charcoal, sans-serif",
    iconSize: 42,
  },
  folder: {
    title: "PiForma Items",
    tabs: [
      {
        id: "main",
        label: "At Ease Items",
        items: [
          previewItem("dos", "DOS Compatibility", 0, "/icons/preview/dos.svg"),
          previewItem("tips", "Helpful Tips", 1, "/icons/preview/mac.svg"),
          previewItem("phone", "Phone Numbers", 2, "/icons/preview/phone.svg"),
          previewItem("sharing", "Sharing Your Computer", 3, "/icons/preview/share.svg"),
          previewItem("simpletext", "SimpleText", 4, "/icons/preview/text.svg"),
          previewItem("support", "Support Information", 5, "/icons/preview/support.svg"),
          previewItem("whyback", "Why Back Up", 6, "/icons/preview/backup.svg"),
        ],
      },
      {
        id: "restore",
        label: "Restore CD",
        items: [previewItem("about", "About This PiForma", 0)],
      },
      {
        id: "parents",
        label: "Parents",
        items: [],
      },
    ],
  },
};

function previewItem(
  id: string,
  label: string,
  slot: number,
  iconUrl = "/icons/missing.png",
): DesktopModel["folder"]["tabs"][number]["items"][number] {
  return {
    id,
    label,
    iconUrl,
    slot,
    disabled: false,
    missing: false,
    warning: null,
    comment: "Preview item",
  };
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function getDesktopModel(): Promise<DesktopModel> {
  if (!isTauriRuntime()) {
    return Promise.resolve(previewModel);
  }

  return invoke<DesktopModel>("get_desktop_model");
}

export function launchItem(itemId: string): Promise<void> {
  if (!isTauriRuntime()) {
    console.info(`AtEase preview launch: ${itemId}`);
    return Promise.resolve();
  }

  return invoke<void>("launch_item", { itemId });
}
