import iconUrl from "../icon.png";
import tileUrl from "../atease-tile.png";
import backgroundTileUrl from "../bg-tile.png";
import appIconUrl from "../app-icon.png";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  getDesktopApps,
  getRuntimeConfig,
  launchDesktopApp,
  playClickSound,
  type DesktopAppModel,
  type FolderTabConfig,
} from "./tauri";

type RenderViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const TAB_WIDTH = 172;
const TAB_LEFT = 21;
const PANEL_WIDTH = 525;
const DEFAULT_HUES = [0, -128, 64, -64, 128];

export class AtEaseApp {
  private readonly root: HTMLElement;
  private animationFrame = 0;
  private apps: DesktopAppModel[] = [];
  private message: string | null = null;
  private folders: FolderTabConfig[] = [];
  private activeFolderId = "main";

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    document.title = "AtEase";
    await this.applyRuntimeConfig();
    this.syncRenderViewport();
    window.addEventListener("resize", () => {
      this.syncRenderViewport();
      this.positionTabs();
    });

    try {
      const model = await getDesktopApps();
      this.apps = model.apps;
      this.message = model.message;
    } catch (error) {
      console.error("Could not load desktop apps", error);
      this.message = "Could not load apps from ~/.local/share/atease/apps/";
    }

    this.render();
  }

  private render(): void {
    const activeFolder = this.getActiveFolder();
    const firstFolder = this.folders[0];
    const secondFolder = this.folders[1] ?? firstFolder;
    const backingFolder = activeFolder.id === firstFolder.id ? secondFolder : firstFolder;
    const statusMessage = this.message
      ? `<div class="app-message" role="status">${this.escapeHtml(this.message)}</div>`
      : "";

    this.root.innerHTML = `
      <main class="app-shell" style="--background-tile-url: url('${backgroundTileUrl}')" aria-label="AtEase">
        <div class="folder-window">
          <div
            class="folder-back-outline"
            aria-hidden="true"
            style="--folder-hue: ${backingFolder.hue}deg; --tile-url: url('${tileUrl}')"
          ></div>
          <div class="folder-tabs" role="tablist" aria-label="Folders">
            ${this.folders.map((folder, index) => this.renderFolderTab(folder, index)).join("")}
          </div>
          <div
            id="folder-panel"
            class="tile-panel"
            style="--folder-hue: ${activeFolder.hue}deg; --tile-url: url('${tileUrl}')"
            role="tabpanel"
            aria-labelledby="folder-tab-${this.escapeHtml(activeFolder.id)}"
          >
            <div class="desktop-grid">
              ${this.renderDesktopSlots(this.apps)}
            </div>
            ${statusMessage}
          </div>
        </div>
      </main>
    `;

    this.centerFolderTabLabels();
    this.positionTabs();
    this.bindInteractions();
  }

  private renderFolderTab(folder: FolderTabConfig, index: number): string {
    const active = folder.id === this.activeFolderId;
    const escapedId = this.escapeHtml(folder.id);
    const escapedLabel = this.escapeHtml(folder.label);
    const patternId = `folder-tab-tile-${index}`;

    return `
      <button
        class="folder-tab-button${active ? " is-active" : ""}"
        id="folder-tab-${escapedId}"
        type="button"
        role="tab"
        aria-selected="${active}"
        aria-controls="folder-panel"
        data-folder-id="${escapedId}"
        data-tab-index="${index}"
        style="--folder-hue: ${folder.hue}deg; --tile-url: url('${tileUrl}')"
      >
        <svg class="folder-tab-shadow" viewBox="0 0 172 22" aria-hidden="true">
          <path d="M0 22 C7 22 9 16 13 8 C15 3 18 0 24 0 H148 C154 0 157 3 159 8 C163 16 165 22 172 22 Z" fill="#000" />
        </svg>
        <svg class="folder-tab-art" viewBox="0 0 172 22" aria-hidden="true">
          <defs>
            <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="64" height="64">
              <image href="${tileUrl}" width="64" height="64" preserveAspectRatio="none" />
            </pattern>
          </defs>
          <path class="folder-tab-fill" d="M0 22 C7 22 9 16 13 8 C15 3 18 0 24 0 H148 C154 0 157 3 159 8 C163 16 165 22 172 22 Z" fill="url(#${patternId})" />
          <path d="M9 16 C11 12 12 9 13 8 C15 3 18 0 24 0 H148 C154 0 157 3 159 8 C160 9 161 12 163 16" fill="none" stroke="rgba(0, 0, 0, 0.75)" stroke-width="1" vector-effect="non-scaling-stroke" />
          <path class="folder-tab-bottom-edge" d="M0 22 C5 22 7 19 9 16 M163 16 C165 19 167 22 172 22" fill="none" stroke="rgba(0, 0, 0, 0.75)" stroke-width="0.5" vector-effect="non-scaling-stroke" />
          <g class="folder-tab-label">
            <image href="${appIconUrl}" x="0" y="0" width="15" height="15" preserveAspectRatio="none" />
            <text x="20" y="8" fill="#111" font-family="ChicagoFLF, Charcoal, Geneva, sans-serif" font-size="13" dominant-baseline="middle">${escapedLabel}</text>
          </g>
        </svg>
        ${active ? `<span class="folder-tab-seam" aria-hidden="true"></span>` : ""}
      </button>
    `;
  }

  private centerFolderTabLabels(): void {
    this.root.querySelectorAll<SVGGElement>(".folder-tab-label").forEach((label) => {
      const labelText = label.querySelector<SVGTextElement>("text");
      if (!labelText) return;
      const labelWidth = 15 + 5 + labelText.getComputedTextLength();
      const labelLeft = (TAB_WIDTH - labelWidth) / 2;
      label.setAttribute("transform", `translate(${Math.round(labelLeft)} 3)`);
    });
  }

  private positionTabs(): void {
    const buttons = Array.from(this.root.querySelectorAll<HTMLButtonElement>(".folder-tab-button"));
    if (buttons.length === 0) return;

    const availableWidth = PANEL_WIDTH - TAB_LEFT * 2;
    const step = buttons.length === 1 ? 0 : (availableWidth - TAB_WIDTH) / (buttons.length - 1);

    buttons.forEach((button, index) => {
      button.style.left = `${Math.round(TAB_LEFT + step * index)}px`;
      button.style.zIndex = button.classList.contains("is-active") ? "20" : String(10 - index);
    });
  }

  private async applyRuntimeConfig(): Promise<void> {
    try {
      const config = await getRuntimeConfig();
      const cornerRadius = Number(config.window.corner_radius);
      if (Number.isFinite(cornerRadius) && cornerRadius >= 0) {
        document.documentElement.style.setProperty("--render-corner-radius", `${Math.floor(cornerRadius)}px`);
      }

      this.folders = config.folders.slice(0, 5).map((folder, index) => ({
        id: folder.id || `folder-${index + 1}`,
        label: folder.label || `Folder ${index + 1}`,
        hue: Number.isFinite(Number(folder.hue)) ? Number(folder.hue) : DEFAULT_HUES[index],
      }));

      if (this.folders.length === 0) {
        this.folders = [{ id: "main", label: "At Ease Items", hue: 0 }];
      }

      this.activeFolderId = this.folders.some((folder) => folder.id === config.startup_folder)
        ? config.startup_folder
        : this.folders[0].id;
    } catch (error) {
      console.error("Could not load runtime config", error);
      this.folders = [
        { id: "main", label: "At Ease Items", hue: 0 },
        { id: "second", label: "Nathan", hue: -128 },
      ];
      this.activeFolderId = "main";
    }
  }

  private bindInteractions(): void {
    this.root.querySelectorAll<HTMLButtonElement>(".bevel-button").forEach((button) => {
      button.addEventListener("click", () => this.handleAppClick(button));
    });

    this.root.querySelectorAll<HTMLButtonElement>(".folder-tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        const folderId = button.dataset.folderId;
        if (!folderId || folderId === this.activeFolderId) return;
        this.requestClickSound();
        this.activeFolderId = folderId;
        this.render();
      });
    });
  }

  private getActiveFolder(): FolderTabConfig {
    return this.folders.find((folder) => folder.id === this.activeFolderId) ?? this.folders[0];
  }

  private renderDesktopSlots(apps: DesktopAppModel[]): string {
    const appsBySlot = new Map<number, DesktopAppModel>();
    apps.forEach((app) => {
      if (app.slot >= 0 && app.slot < 12) appsBySlot.set(app.slot, app);
    });

    return Array.from({ length: 12 }, (_, slot) => {
      const app = appsBySlot.get(slot);
      if (!app) return `<div class="desktop-slot" aria-hidden="true"></div>`;

      const label = this.escapeHtml(app.name);
      const title = this.escapeHtml(app.error ?? app.comment ?? app.name);
      const icon = this.escapeHtml(this.iconSource(app.iconUrl || iconUrl));
      const disabled = app.disabled ? " disabled" : "";

      return `
        <div class="desktop-item">
          <button class="bevel-button" type="button" aria-label="${label}" title="${title}" data-app-id="${this.escapeHtml(app.id)}"${disabled}>
            <img class="button-icon" src="${icon}" alt="" draggable="false" />
          </button>
          <span class="item-name">${label}</span>
        </div>
      `;
    }).join("");
  }

  private async handleAppClick(button: HTMLButtonElement): Promise<void> {
    const appId = button.dataset.appId;
    if (!appId || button.disabled) return;
    this.requestClickSound();
    this.playOpenAnimation(button);
    await this.wait(100);

    try {
      await launchDesktopApp(appId);
      this.setStatusMessage(null);
    } catch (error) {
      console.error(`Could not launch desktop app ${appId}`, error);
      this.setStatusMessage("Could not launch app.");
    }
  }

  private requestClickSound(): void {
    void playClickSound().catch((error) => {
      console.warn("Could not request click sound", error);
    });
  }

  private setStatusMessage(message: string | null): void {
    const existing = this.root.querySelector<HTMLElement>(".app-message");
    if (!message) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.textContent = message;
      return;
    }
    const panel = this.root.querySelector<HTMLElement>(".tile-panel");
    const element = document.createElement("div");
    element.className = "app-message";
    element.setAttribute("role", "status");
    element.textContent = message;
    panel?.append(element);
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  private iconSource(iconPathOrUrl: string): string {
    if (
      iconPathOrUrl.startsWith("/icons/") ||
      iconPathOrUrl.startsWith("asset:") ||
      iconPathOrUrl.startsWith("data:") ||
      iconPathOrUrl.startsWith("http://") ||
      iconPathOrUrl.startsWith("https://")
    ) return iconPathOrUrl;
    if (iconPathOrUrl.startsWith("/")) return convertFileSrc(iconPathOrUrl);
    return iconPathOrUrl;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
  }

  private playOpenAnimation(button: HTMLButtonElement): void {
    window.cancelAnimationFrame(this.animationFrame);
    document.querySelectorAll(".open-animation").forEach((box) => box.remove());

    const buttonRect = button.getBoundingClientRect();
    const renderViewport = this.syncRenderViewport();
    const start = { left: buttonRect.left, top: buttonRect.top, width: buttonRect.width, height: buttonRect.height };
    const end = { left: renderViewport.left, top: renderViewport.top, width: renderViewport.width, height: renderViewport.height };
    const startCenter = { x: start.left + start.width / 2, y: start.top + start.height / 2 };
    const viewportCenter = { x: end.left + end.width / 2, y: end.top + end.height / 2 };
    const squareEndSize = Math.min(end.width, end.height);
    const squareEnd = {
      left: viewportCenter.x - squareEndSize / 2,
      top: viewportCenter.y - squareEndSize / 2,
      width: squareEndSize,
      height: squareEndSize,
    };
    const frames = 16;
    const traces = [
      { delay: 0, element: document.createElement("div") },
      { delay: 3, element: document.createElement("div") },
      { delay: 6, element: document.createElement("div") },
    ];
    let frame = 0;

    traces.forEach((trace, index) => {
      trace.element.className = `open-animation open-animation-${index + 1}`;
      document.body.append(trace.element);
    });

    const draw = (): void => {
      traces.forEach(({ delay, element }) => {
        const traceFrame = frame - delay;
        const progress = Math.max(0, Math.min(traceFrame / frames, 1));
        const squarePhaseEnd = 0.5;
        const squareProgress = Math.min(progress / squarePhaseEnd, 1);
        const rectangleProgress = Math.max((progress - squarePhaseEnd) / (1 - squarePhaseEnd), 0);
        const squareSize = start.width + (squareEndSize - start.width) * squareProgress;
        const squareCenterX = startCenter.x + (viewportCenter.x - startCenter.x) * squareProgress;
        const squareCenterY = startCenter.y + (viewportCenter.y - startCenter.y) * squareProgress;
        const squareLeft = squareCenterX - squareSize / 2;
        const squareTop = squareCenterY - squareSize / 2;
        const left = squareLeft + (end.left - squareEnd.left) * rectangleProgress;
        const top = squareTop + (end.top - squareEnd.top) * rectangleProgress;
        const width = squareSize + (end.width - squareEnd.width) * rectangleProgress;
        const height = squareSize + (end.height - squareEnd.height) * rectangleProgress;

        element.style.visibility = traceFrame < 0 || traceFrame % 2 !== 0 ? "hidden" : "visible";
        element.style.left = `${Math.round(left)}px`;
        element.style.top = `${Math.round(top)}px`;
        element.style.width = `${Math.round(width)}px`;
        element.style.height = `${Math.round(height)}px`;
      });

      frame += 1;
      if (frame <= frames + traces.at(-1)!.delay) {
        this.animationFrame = window.requestAnimationFrame(draw);
        return;
      }
      window.setTimeout(() => traces.forEach(({ element }) => element.remove()), 70);
    };

    draw();
  }

  private syncRenderViewport(): RenderViewport {
    const margins = this.readRenderMargins();
    const rawWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
    const rawHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
    const horizontalMargins = Math.min(rawWidth, margins.left + margins.right);
    const verticalMargins = Math.min(rawHeight, margins.top + margins.bottom);
    const left = Math.min(margins.left, rawWidth);
    const top = Math.min(margins.top, rawHeight);
    const width = Math.max(0, rawWidth - horizontalMargins);
    const height = Math.max(0, rawHeight - verticalMargins);

    document.documentElement.style.setProperty("--render-left", `${left}px`);
    document.documentElement.style.setProperty("--render-right", `${Math.min(margins.right, rawWidth)}px`);
    document.documentElement.style.setProperty("--render-top", `${top}px`);
    document.documentElement.style.setProperty("--render-bottom", `${Math.min(margins.bottom, rawHeight)}px`);
    document.documentElement.style.setProperty("--render-width", `${width}px`);
    document.documentElement.style.setProperty("--render-height", `${height}px`);
    return { left, top, width, height };
  }

  private readRenderMargins(): { left: number; right: number; top: number; bottom: number } {
    const params = new URLSearchParams(window.location.search);
    return {
      left: this.readRenderMargin(params, ["left", "safeLeft", "safe-left", "safe_left"]),
      right: this.readRenderMargin(params, ["right", "safeRight", "safe-right", "safe_right"]),
      top: this.readRenderMargin(params, ["top", "safeTop", "safe-top", "safe_top"]),
      bottom: this.readRenderMargin(params, ["bottom", "safeBottom", "safe-bottom", "safe_bottom"]),
    };
  }

  private readRenderMargin(params: URLSearchParams, keys: string[]): number {
    for (const key of keys) {
      if (!params.has(key)) continue;
      const value = Number(params.get(key));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    }
    return 0;
  }
}
