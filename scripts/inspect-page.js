import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:1420/";
const OUT_DIR = "artifacts";
const SCREENSHOT_PATH = `${OUT_DIR}/screenshot-home.png`;
const LAYOUT_PATH = `${OUT_DIR}/layout.json`;

const selectors = [
  ["app", "#app"],
  ["desktopShell", ".desktop-shell"],
  ["stage", ".scaled-stage"],
  ["folder", ".at-ease-folder-view"],
  ["tabBar", ".tab-bar"],
  ["tabs", ".tab"],
  ["selectedTab", ".tab.selected"],
  ["folderBody", ".folder-body"],
  ["itemGrid", ".item-grid"],
  ["gridCells", ".grid-cell"],
  ["items", ".at-ease-item"],
  ["buttons", ".launcher-button"],
  ["icons", ".icon"],
  ["labels", ".item-label"],
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });

await page.goto(APP_URL, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });

const layout = await page.evaluate((entries) => {
  const round = (value) => Math.round(value * 100) / 100;
  const readBox = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      text: element.textContent?.trim() ?? "",
      box: {
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
        top: round(rect.top),
        right: round(rect.right),
        bottom: round(rect.bottom),
        left: round(rect.left),
      },
      styles: {
        display: style.display,
        position: style.position,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderTop: style.borderTop,
        borderRight: style.borderRight,
        borderBottom: style.borderBottom,
        borderLeft: style.borderLeft,
        boxShadow: style.boxShadow,
        padding: style.padding,
        margin: style.margin,
      },
    };
  };

  const result = {
    url: window.location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
    capturedAt: new Date().toISOString(),
    elements: {},
  };

  for (const [name, selector] of entries) {
    result.elements[name] = Array.from(document.querySelectorAll(selector)).map(readBox);
  }

  return result;
}, selectors);

await writeFile(LAYOUT_PATH, `${JSON.stringify(layout, null, 2)}\n`);
await browser.close();

console.log(`Saved ${SCREENSHOT_PATH}`);
console.log(`Saved ${LAYOUT_PATH}`);
