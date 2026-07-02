import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:1420/";
const OUT_DIR = "artifacts";
const SCREENSHOT_PATH = `${OUT_DIR}/screenshot-home.png`;

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });

await page.goto(APP_URL, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });

await browser.close();

console.log(`Saved ${SCREENSHOT_PATH}`);
