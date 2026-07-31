import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import type { Excerpt } from "../evidence.ts";
import type { Verdict } from "../judge/validate.ts";
import type { Stats } from "../types.ts";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardHtmlDocument,
  cardTemplate,
} from "./template.ts";

interface FontBuffers {
  regular: ArrayBuffer;
  bold: ArrayBuffer;
}

let fontBuffers: Promise<FontBuffers> | undefined;

function loadFonts(): Promise<FontBuffers> {
  const cardDir = dirname(fileURLToPath(import.meta.url));
  fontBuffers ??= Promise.all([
    Bun.file(resolve(cardDir, "../../assets/fonts/Inter-Regular.ttf")).arrayBuffer(),
    Bun.file(resolve(cardDir, "../../assets/fonts/Inter-Bold.ttf")).arrayBuffer(),
  ]).then(([regular, bold]) => ({ regular, bold }));
  return fontBuffers;
}

function fontDataUrl(buffer: ArrayBuffer): string {
  return `data:font/ttf;base64,${Buffer.from(buffer).toString("base64")}`;
}

/** Render the conduct-card template to a deterministic 1200×675 PNG and write it locally. */
export async function renderCard(
  verdict: Verdict,
  stats: Stats,
  excerpts: Excerpt[],
  outPath: string,
): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const svg = await satori(cardTemplate(verdict, stats, excerpts) as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: "Inter", data: fonts.regular, weight: 400, style: "normal" },
      { name: "Inter", data: fonts.bold, weight: 700, style: "normal" },
    ],
  });
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: CARD_WIDTH },
  }).render().asPng();

  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await writeFile(outPath, png);
  return png;
}

/** Export the identical template as a self-contained HTML document for site/OG reuse. */
export async function renderCardHtml(
  verdict: Verdict,
  stats: Stats,
  excerpts: Excerpt[],
): Promise<string> {
  const fonts = await loadFonts();
  return cardHtmlDocument(verdict, stats, excerpts, {
    regular: fontDataUrl(fonts.regular),
    bold: fontDataUrl(fonts.bold),
  });
}

export { CARD_HEIGHT, CARD_SITE_URL, CARD_WIDTH, cardTemplate } from "./template.ts";
