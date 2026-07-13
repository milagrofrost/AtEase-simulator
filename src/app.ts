import iconUrl from "../icon.png";
import tileUrl from "../atease-tile.png";
import backgroundTileUrl from "../bg-tile.png";
import appIconUrl from "../app-icon.png";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getDesktopApps, getRuntimeConfig, launchDesktopApp, playClickSound, type DesktopAppModel } from "./tauri";

type RenderViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export class AtEaseApp {
  private readonly root: HTMLElement;
  private animationFrame = 0;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    document.title = "AtEase";
    await this.applyRuntimeConfig();
    this.syncRenderViewport();
    window.addEventListener("resize", () => this.syncRenderViewport());

    let apps: DesktopAppModel[] = [];
    let message: string | null = null;
    try {
      const model = await getDesktopApps();
      apps = model.apps;
      message = model.message;
    } catch (error) {
      console.error("Could not load desktop apps", error);
      message = "Could not load apps from ~/.local/share/atease/apps/";
    }

    const items = this.renderDesktopSlots(apps);
    const statusMessage = message
      ? `<div class="app-message" role="status">${this.escapeHtml(message)}</div>`
      : "";

    this.root.innerHTML = `
      <main class="app-shell" style="--background-tile-url: url('${backgroundTileUrl}')" aria-label="AtEase">
        <div class="folder-window" style="--tile-url: url('${tileUrl}')">
          <svg class="folder-tab-shadow" viewBox="0 0 172 22" aria-hidden="true">
            <path
              d="M0 22 C7 22 9 16 13 8 C15 3 18 0 24 0 H148 C154 0 157 3 159 8 C163 16 165 22 172 22 Z"
              fill="#000"
            />
          </svg>
          <svg class="folder-tab" viewBox="0 0 172 22" aria-hidden="true">
            <defs>
              <pattern id="folder-tab-tile" patternUnits="userSpaceOnUse" width="64" height="64">
                <image href="${tileUrl}" width="64" height="64" preserveAspectRatio="none" />
              </pattern>
            </defs>
            <path
              d="M0 22 C7 22 9 16 13 8 C15 3 18 0 24 0 H148 C154 0 157 3 159 8 C163 16 165 22 172 22 Z"
              fill="url(#folder-tab-tile)"
            />
            <path
              d="M9 16 C11 12 12 9 13 8 C15 3 18 0 24 0 H148 C154 0 157 3 159 8 C160 9 161 12 163 16"
              fill="none"
              stroke="rgba(0, 0, 0, 0.75)"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <path
              d="M0 22 C5 22 7 19 9 16 M163 16 C165 19 167 22 172 22"
              fill="none"
              stroke="rgba(0, 0, 0, 0.75)"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
            <g class="folder-tab-label">
              <image href="${appIconUrl}" x="0" y="0" width="15" height="15" preserveAspectRatio="none" />
              <text
                x="20"
                y="8"
                fill="#111"
                font-family="ChicagoFLF, Charcoal, Geneva, sans-serif"
                font-size="13"
                dominant-baseline="middle"
              >At-Ease Items</text>
            </g>
          </svg>
          <div class="folder-tab-seam" aria-hidden="true"></div>
          <div class="tile-panel">
            <div class="desktop-grid">
              ${items}
            </div>
            ${statusMessage}
          </div>
        </div>
      </main>
    `;
    this.centerFolderTabLabel();
    this.bindButtonAnimations();
  }

  private centerFolderTabLabel(): void {
    const label = this.root.querySelector<SVGGElement>(".folder-tab-label");
    const labelText = label?.querySelector<SVGTextElement>("text");
    if (!label || !labelText) return;

    const iconWidth = 15;
    const iconGap = 5;
    const labelWidth = iconWidth + iconGap + labelText.getComputedTextLength();
    const labelLeft = (172 - labelWidth) / 2;
    label.setAttribute("transform", `translate(${Math.round(labelLeft)} 3)`);
  }

  private async applyRuntimeConfig(): Promise<void> {
    try {
      const config = await getRuntimeConfig();
      const cornerRadius = Number(config.window.corner_radius);
      if (Number.isFinite(cornerRadius) && cornerRadius >= 0) {
        document.documentElement.style.setProperty("--render-corner-radius", `${Math.floor(cornerRadius)}px`);
      }
    } catch (error) {
      console.error("Could not load runtime config", error);
    }
  }

  private bindButtonAnimations(): void {
    this.root.querySelectorAll<HTMLButtonElement>(".bevel-button").forEach((button) => {
      button.addEventListener("click", () => this.handleAppClick(button));
    });
  }

  private renderDesktopSlots(apps: DesktopAppModel[]): string {
    const appsBySlot = new Map<number, DesktopAppModel>();
    apps.forEach((app) => {
      if (app.slot >= 0 && app.slot < 12) {
        appsBySlot.set(app.slot, app);
      }
    });

    return Array.from({ length: 12 }, (_, slot) => {
      const app = appsBySlot.get(slot);
      if (!app) {
        return `<div class="desktop-slot" aria-hidden="true"></div>`;
      }

      const label = this.escapeHtml(app.name);
      const title = this.escapeHtml(app.error ?? app.comment ?? app.name);
      const icon = this.escapeHtml(this.iconSource(app.iconUrl || iconUrl));
      const disabled = app.disabled ? " disabled" : "";

      return `
        <div class="desktop-item">
          <button
            class="bevel-button"
            type="button"
            aria-label="${label}"
            title="${title}"
            data-app-id="${this.escapeHtml(app.id)}"
            ${disabled}
          >
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

    void playClickSound().catch((error) => {
      console.warn("Could not request click sound", error);
    });
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
    ) {
      return iconPathOrUrl;
    }

    if (iconPathOrUrl.startsWith("/")) {
      return convertFileSrc(iconPathOrUrl);
    }

    return iconPathOrUrl;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return character;
      }
    });
  }

  private playOpenAnimation(button: HTMLButtonElement): void {
    window.cancelAnimationFrame(this.animationFrame);
    document.querySelectorAll(".open-animation").forEach((box) => box.remove());

    const buttonRect = button.getBoundingClientRect();
    const renderViewport = this.syncRenderViewport();
    const start = {
      left: buttonRect.left,
      top: buttonRect.top,
      width: buttonRect.width,
      height: buttonRect.height,
    };
    const end = {
      left: renderViewport.left,
      top: renderViewport.top,
      width: renderViewport.width,
      height: renderViewport.height,
    };
    const startCenter = {
      x: start.left + start.width / 2,
      y: start.top + start.height / 2,
    };
    const viewportCenter = {
      x: end.left + end.width / 2,
      y: end.top + end.height / 2,
    };
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

      window.setTimeout(() => {
        traces.forEach(({ element }) => element.remove());
      }, 70);
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
