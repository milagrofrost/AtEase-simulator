import iconUrl from "../icon.png";
import tileUrl from "../atease-tile.png";

export class AtEaseApp {
  private readonly root: HTMLElement;
  private animationFrame = 0;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    document.title = "AtEase";
    const items = Array.from(
      { length: 16 },
      (_, index) => `
        <div class="desktop-item${index >= 10 ? " is-invisible" : ""}">
          <button class="bevel-button" type="button" aria-label="computer">
            <img class="button-icon" src="${iconUrl}" alt="" draggable="false" />
          </button>
          <span class="item-name">computer</span>
        </div>
      `,
    ).join("");

    this.root.innerHTML = `
      <main class="app-shell" aria-label="AtEase">
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
              stroke="#000"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <path
              d="M0 22 C5 22 7 19 9 16 M163 16 C165 19 167 22 172 22"
              fill="none"
              stroke="#000"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
            <text
              x="86"
              y="11"
              fill="#111"
              font-family="ChicagoFLF, Charcoal, Geneva, sans-serif"
              font-size="14"
              text-anchor="middle"
              dominant-baseline="middle"
            >At-Ease Items</text>
          </svg>
          <div class="folder-tab-seam" aria-hidden="true"></div>
          <div class="tile-panel">
            <div class="desktop-grid">
              ${items}
            </div>
          </div>
        </div>
      </main>
    `;
    this.bindButtonAnimations();
  }

  private bindButtonAnimations(): void {
    this.root.querySelectorAll<HTMLButtonElement>(".bevel-button").forEach((button) => {
      button.addEventListener("click", () => this.playOpenAnimation(button));
    });
  }

  private playOpenAnimation(button: HTMLButtonElement): void {
    window.cancelAnimationFrame(this.animationFrame);
    this.root.querySelector(".open-animation")?.remove();

    const buttonRect = button.getBoundingClientRect();
    const panelRect = this.root.querySelector(".tile-panel")?.getBoundingClientRect();
    if (!panelRect) return;

    const start = {
      left: buttonRect.left + buttonRect.width / 2,
      top: buttonRect.top + buttonRect.height / 2,
      width: 1,
      height: 1,
    };
    const end = {
      left: panelRect.left + 18,
      top: panelRect.top + 18,
      width: panelRect.width - 36,
      height: panelRect.height - 36,
    };
    const frames = 12;
    let frame = 0;

    const box = document.createElement("div");
    box.className = "open-animation";
    document.body.append(box);

    const draw = (): void => {
      const progress = frame / frames;
      const left = start.left + (end.left - start.left) * progress;
      const top = start.top + (end.top - start.top) * progress;
      const width = start.width + (end.width - start.width) * progress;
      const height = start.height + (end.height - start.height) * progress;

      box.style.left = `${Math.round(left)}px`;
      box.style.top = `${Math.round(top)}px`;
      box.style.width = `${Math.round(width)}px`;
      box.style.height = `${Math.round(height)}px`;

      frame += 1;
      if (frame <= frames) {
        this.animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      window.setTimeout(() => box.remove(), 70);
    };

    draw();
  }
}
