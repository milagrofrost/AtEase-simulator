export interface DesktopModel {
  appTitle: string;
  startupTab: string;
  clickSoundEnabled: boolean;
  clickSoundUrl: string | null;
  display: DisplayModel;
  theme: ThemeModel;
  folder: FolderModel;
}

export interface DisplayModel {
  baseWidth: number;
  baseHeight: number;
  safeArea: SafeArea;
  scaleMode: string;
}

export interface SafeArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ThemeModel {
  desktopTileUrl: string;
  folderTileUrl: string;
  tabTileUrl: string;
  fontFamily: string;
  iconSize: number;
}

export interface FolderModel {
  title: string;
  tabs: TabModel[];
}

export interface TabModel {
  id: string;
  label: string;
  items: ItemModel[];
}

export interface ItemModel {
  id: string;
  label: string;
  iconUrl: string;
  slot: number;
  disabled: boolean;
  missing: boolean;
  warning: string | null;
  comment: string | null;
}
