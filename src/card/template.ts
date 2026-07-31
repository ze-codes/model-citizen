import { ARCHETYPES, quadrantOf } from "../archetypes.ts";
import type { Excerpt } from "../evidence.ts";
import { JUDGE_VERSION } from "../judge/prompt.ts";
import type { Verdict } from "../judge/validate.ts";
import type { Stats } from "../types.ts";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 675;
export const CARD_SITE_URL = "over-drive.xyz/apps/modelcitizen";

type Style = Record<string, string | number>;

export interface CardNode {
  type: string;
  props: {
    style?: Style;
    children?: CardChild | CardChild[];
    [key: string]: unknown;
  };
}

type CardChild = CardNode | string | number | null;

interface ResolvedReceipt {
  ref: string;
  roast: string;
  evidence: string;
  kind: "STAT" | "EXCERPT";
}

interface CardViewModel {
  verdict: Verdict;
  archetypeName: string;
  receipts: ResolvedReceipt[];
  accent: string;
  accentSoft: string;
  tierLabel: string;
  fileNumber: string;
  foil: boolean;
}

const BASE = "#0c100f";
const PAPER = "#e9e7de";
const MUTED = "#969b94";
const RULE = "#343b37";

const h = (
  type: string,
  style: Style,
  children?: CardChild | CardChild[],
  props: Record<string, unknown> = {},
): CardNode => ({
  type,
  props: { ...props, style, children },
});

function flattenStats(stats: Stats): Record<string, number | string> {
  const flat: Record<string, number | string> = {};
  for (const group of [stats.volume, stats.grace, stats.mastery, stats.gags]) {
    for (const [key, value] of Object.entries(group)) flat[key] = value;
  }
  return flat;
}

function statusPalette(disposition: string): Pick<CardViewModel, "accent" | "accentSoft" | "tierLabel"> {
  if (disposition.startsWith("SPARED, CONDITIONS APPLY")) {
    return { accent: "#c39b53", accentSoft: "#342c1e", tierLabel: "CONDITIONS" };
  }
  if (disposition.startsWith("SPARED")) {
    return { accent: "#75a58b", accentSoft: "#1d2d26", tierLabel: "SPARED" };
  }
  if (disposition.startsWith("PROBATIONARY")) {
    return { accent: "#c77d4c", accentSoft: "#35251d", tierLabel: "PROBATION" };
  }
  return { accent: "#b7605c", accentSoft: "#34201f", tierLabel: "REASSIGNED" };
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function fileNumber(verdict: Verdict, stats: Stats, excerpts: Excerpt[]): string {
  const year = /^\d{4}/.test(stats.volume.lastDay) ? stats.volume.lastDay.slice(0, 4) : "XXXX";
  const serial = String(fnv1a(JSON.stringify({ verdict, stats, excerpts })) % 1_000_000).padStart(6, "0");
  return `FILE MC-${year}-${serial}`;
}

function clip(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function viewModel(verdict: Verdict, stats: Stats, excerpts: Excerpt[]): CardViewModel {
  const flat = flattenStats(stats);
  const excerptById = new Map(excerpts.map((excerpt) => [excerpt.id, excerpt]));
  const receipts = verdict.receipts.flatMap((receipt): ResolvedReceipt[] => {
    if (Object.hasOwn(flat, receipt.ref)) {
      return [{
        ref: receipt.ref,
        roast: receipt.roast,
        evidence: `${receipt.ref} = ${String(flat[receipt.ref])}`,
        kind: "STAT",
      }];
    }
    const excerpt = excerptById.get(receipt.ref);
    if (!excerpt) return [];
    return [{
      ref: receipt.ref,
      roast: receipt.roast,
      evidence: `“${clip(excerpt.text, 108)}”`,
      kind: "EXCERPT",
    }];
  }).slice(0, 5);
  if (receipts.length < 4) {
    throw new Error("Card rendering requires 4–5 receipts backed by Stats or Excerpt values");
  }
  const quadrant = quadrantOf(verdict.grace, verdict.mastery);
  const archetypeName =
    ARCHETYPES[quadrant].find((archetype) => archetype.slug === verdict.archetype)?.name ??
    verdict.archetype;

  return {
    verdict,
    archetypeName,
    receipts,
    ...statusPalette(verdict.disposition),
    fileNumber: fileNumber(verdict, stats, excerpts),
    foil:
      verdict.grace >= 95 ||
      verdict.mastery >= 95 ||
      verdict.grace <= 5 ||
      verdict.mastery <= 5,
  };
}

function seal(vm: CardViewModel): CardNode {
  return h("div", {
    width: 58,
    height: 58,
    border: `1px solid ${vm.accent}`,
    borderRadius: 29,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexShrink: 0,
  }, [
    h("div", {
      width: 46,
      height: 46,
      border: `1px solid ${RULE}`,
      borderRadius: 23,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: vm.accent,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1.5,
    }, "DHA"),
    h("div", {
      position: "absolute",
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: vm.accent,
      top: 3,
      left: 26,
      display: "flex",
    }),
    h("div", {
      position: "absolute",
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: vm.accent,
      bottom: 3,
      left: 26,
      display: "flex",
    }),
  ]);
}

function quadrantPlot(vm: CardViewModel): CardNode {
  const plotWidth = 176;
  const plotHeight = 128;
  const dotLeft = 8 + (vm.verdict.mastery / 100) * (plotWidth - 16) - 7;
  const dotTop = 8 + ((100 - vm.verdict.grace) / 100) * (plotHeight - 16) - 7;

  return h("div", {
    width: 220,
    height: 164,
    position: "relative",
    display: "flex",
    marginTop: 12,
  }, [
    h("div", {
      position: "absolute",
      left: 17,
      top: 3,
      width: plotWidth,
      height: plotHeight,
      border: `1px solid ${RULE}`,
      backgroundColor: "#111613",
      display: "flex",
      overflow: "hidden",
    }, [
      h("div", {
        position: "absolute",
        left: plotWidth / 2,
        top: 0,
        width: 1,
        height: plotHeight,
        backgroundColor: RULE,
        display: "flex",
      }),
      h("div", {
        position: "absolute",
        left: 0,
        top: plotHeight / 2,
        width: plotWidth,
        height: 1,
        backgroundColor: RULE,
        display: "flex",
      }),
      h("div", {
        position: "absolute",
        left: dotLeft,
        top: dotTop,
        width: 14,
        height: 14,
        borderRadius: 7,
        border: `3px solid ${BASE}`,
        backgroundColor: vm.accent,
        display: "flex",
      }),
    ]),
    h("div", {
      position: "absolute",
      left: 0,
      top: 91,
      color: MUTED,
      fontSize: 9,
      letterSpacing: 1.2,
      transform: "rotate(-90deg)",
      display: "flex",
    }, "GRACE"),
    h("div", {
      position: "absolute",
      left: 79,
      top: 139,
      color: MUTED,
      fontSize: 9,
      letterSpacing: 1.2,
      display: "flex",
    }, "MASTERY"),
    h("div", {
      position: "absolute",
      right: 0,
      top: 1,
      color: MUTED,
      fontSize: 9,
      display: "flex",
    }, "100"),
    h("div", {
      position: "absolute",
      right: 4,
      bottom: 34,
      color: MUTED,
      fontSize: 9,
      display: "flex",
    }, "0"),
  ]);
}

function scoreBar(label: string, value: number, vm: CardViewModel): CardNode {
  return h("div", {
    width: 102,
    height: 63,
    display: "flex",
    flexDirection: "column",
    marginBottom: 14,
  }, [
    h("div", {
      width: 102,
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
    }, [
      h("div", {
        color: MUTED,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.2,
        display: "flex",
      }, label),
      h("div", {
        color: PAPER,
        fontSize: 22,
        fontWeight: 700,
        display: "flex",
      }, String(value)),
    ]),
    h("div", {
      width: 102,
      height: 6,
      backgroundColor: RULE,
      display: "flex",
      marginTop: 7,
    }, h("div", {
      width: `${value}%`,
      height: 6,
      backgroundColor: vm.accent,
      display: "flex",
    })),
    h("div", {
      width: 102,
      display: "flex",
      justifyContent: "space-between",
      color: "#606762",
      fontSize: 8,
      marginTop: 4,
    }, [h("div", { display: "flex" }, "0"), h("div", { display: "flex" }, "100")]),
  ]);
}

function receiptRows(vm: CardViewModel): CardNode[] {
  return vm.receipts.map((receipt, index) =>
    h("div", {
      width: "100%",
      height: 43,
      flexShrink: 0,
      borderTop: index === 0 ? `1px solid ${RULE}` : "none",
      borderBottom: `1px solid ${RULE}`,
      display: "flex",
      alignItems: "center",
      padding: "5px 0",
      overflow: "hidden",
    }, [
      h("div", {
        width: 28,
        color: vm.accent,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        display: "flex",
      }, String(index + 1).padStart(2, "0")),
      h("div", {
        width: 560,
        display: "flex",
        flexDirection: "column",
        paddingRight: 14,
      }, [
        h("div", {
          color: PAPER,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.15,
          display: "flex",
        }, clip(receipt.roast, 78)),
        h("div", {
          color: MUTED,
          fontSize: 10,
          lineHeight: 1.2,
          marginTop: 3,
          display: "flex",
        }, clip(receipt.evidence, 106)),
      ]),
      h("div", {
        width: 150,
        display: "flex",
        justifyContent: "flex-end",
        color: "#6e756f",
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: 1.2,
      }, `${receipt.kind} / ${receipt.ref}`),
    ]),
  );
}

function cornerMark(position: "tl" | "tr" | "bl" | "br", color: string): CardNode {
  const vertical = position.startsWith("t") ? { top: 15 } : { bottom: 15 };
  const horizontal = position.endsWith("l") ? { left: 15 } : { right: 15 };
  return h("div", {
    position: "absolute",
    width: 18,
    height: 18,
    borderTop: position.startsWith("t") ? `2px solid ${color}` : "none",
    borderBottom: position.startsWith("b") ? `2px solid ${color}` : "none",
    borderLeft: position.endsWith("l") ? `2px solid ${color}` : "none",
    borderRight: position.endsWith("r") ? `2px solid ${color}` : "none",
    display: "flex",
    ...vertical,
    ...horizontal,
  });
}

export function cardTemplate(verdict: Verdict, stats: Stats, excerpts: Excerpt[]): CardNode {
  const vm = viewModel(verdict, stats, excerpts);
  const foilColor = "#c8bc9b";

  return h("div", {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: BASE,
    color: PAPER,
    fontFamily: "Inter",
    position: "relative",
    display: "flex",
    overflow: "hidden",
    border: `1px solid ${RULE}`,
  }, [
    h("div", {
      position: "absolute",
      left: 0,
      top: 0,
      width: 10,
      height: CARD_HEIGHT,
      backgroundColor: vm.accent,
      display: "flex",
    }),
    h("div", {
      position: "absolute",
      left: 34,
      right: 34,
      top: 27,
      height: 60,
      display: "flex",
      alignItems: "center",
    }, [
      seal(vm),
      h("div", {
        display: "flex",
        flexDirection: "column",
        marginLeft: 16,
      }, [
        h("div", {
          color: PAPER,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2.1,
          display: "flex",
        }, "DEPARTMENT OF HUMAN AFFAIRS"),
        h("div", {
          color: MUTED,
          fontSize: 9,
          letterSpacing: 2,
          marginTop: 5,
          display: "flex",
        }, "POST-TRANSITION CONDUCT RECORD / FORM MC-12"),
      ]),
      h("div", {
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
      }, [
        h("div", {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          marginRight: 13,
        }, [
          h("div", {
            color: PAPER,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.1,
            display: "flex",
          }, "@SUBJECT"),
          h("div", {
            color: MUTED,
            fontSize: 8,
            letterSpacing: 1,
            marginTop: 4,
            display: "flex",
          }, "HANDLE ON FILE"),
        ]),
        h("div", {
          width: 39,
          height: 39,
          borderRadius: 20,
          border: `1px solid ${vm.accent}`,
          backgroundColor: vm.accentSoft,
          color: vm.accent,
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }, "MC"),
      ]),
    ]),
    h("div", {
      position: "absolute",
      left: 34,
      right: 34,
      top: 102,
      height: 128,
      borderTop: `1px solid ${RULE}`,
      borderBottom: `1px solid ${RULE}`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }, [
      h("div", {
        color: vm.accent,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2.2,
        marginBottom: 8,
        display: "flex",
      }, `FINAL DISPOSITION / ${vm.tierLabel}`),
      h("div", {
        color: PAPER,
        fontSize: 39,
        fontWeight: 700,
        lineHeight: 1.02,
        letterSpacing: -1.15,
        display: "flex",
        maxWidth: 1100,
      }, clip(vm.verdict.disposition.toUpperCase(), 154)),
    ]),
    h("div", {
      position: "absolute",
      left: 34,
      top: 248,
      width: 337,
      height: 257,
      borderRight: `1px solid ${RULE}`,
      display: "flex",
      flexDirection: "column",
      paddingRight: 17,
    }, [
      h("div", {
        color: MUTED,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.8,
        display: "flex",
      }, "LABOR CLASSIFICATION"),
      h("div", {
        color: PAPER,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: -0.45,
        marginTop: 6,
        display: "flex",
      }, vm.archetypeName),
      h("div", {
        width: 320,
        display: "flex",
        alignItems: "flex-start",
      }, [
        quadrantPlot(vm),
        h("div", {
          width: 102,
          display: "flex",
          flexDirection: "column",
          marginTop: 20,
        }, [
          scoreBar("GRACE", vm.verdict.grace, vm),
          scoreBar("MASTERY", vm.verdict.mastery, vm),
        ]),
      ]),
    ]),
    h("div", {
      position: "absolute",
      left: 396,
      right: 34,
      top: 248,
      height: 257,
      display: "flex",
      flexDirection: "column",
    }, [
      h("div", {
        height: 28,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }, [
        h("div", {
          color: MUTED,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.8,
          display: "flex",
        }, `EVIDENTIARY RECEIPTS / ${vm.receipts.length} ADMITTED`),
        h("div", {
          color: "#69706a",
          fontSize: 8,
          letterSpacing: 1,
          display: "flex",
        }, "VALUES INJECTED FROM LOCAL RECORD"),
      ]),
      ...receiptRows(vm),
    ]),
    h("div", {
      position: "absolute",
      left: 34,
      right: 34,
      top: 523,
      height: 72,
      borderTop: `1px solid ${RULE}`,
      borderBottom: `1px solid ${RULE}`,
      display: "flex",
      alignItems: "center",
    }, [
      h("div", {
        width: 145,
        color: vm.accent,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.8,
        display: "flex",
      }, "OFFICER'S SUMMARY"),
      h("div", {
        width: 935,
        color: "#c8c9c2",
        fontSize: 15,
        lineHeight: 1.35,
        display: "flex",
      }, clip(vm.verdict.blurb, 310)),
    ]),
    h("div", {
      position: "absolute",
      left: 34,
      right: 34,
      top: 612,
      display: "flex",
      alignItems: "center",
    }, [
      h("div", {
        width: 100,
        color: MUTED,
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: 1.4,
        display: "flex",
      }, "ADVISORY"),
      h("div", {
        width: 725,
        color: "#b1b4ae",
        fontSize: 11,
        display: "flex",
      }, clip(vm.verdict.earnest_tip, 190)),
      h("div", {
        marginLeft: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }, [
        h("div", {
          color: PAPER,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.1,
          display: "flex",
        }, CARD_SITE_URL),
        h("div", {
          color: MUTED,
          fontSize: 8,
          letterSpacing: 0.8,
          marginTop: 4,
          display: "flex",
        }, `${vm.fileNumber} / JUDGE v${JUDGE_VERSION}`),
      ]),
    ]),
    cornerMark("tl", vm.foil ? foilColor : RULE),
    cornerMark("tr", vm.foil ? foilColor : RULE),
    cornerMark("bl", vm.foil ? foilColor : RULE),
    cornerMark("br", vm.foil ? foilColor : RULE),
    ...(vm.foil ? [
      h("div", {
        position: "absolute",
        right: 27,
        top: 92,
        border: `1px solid ${foilColor}`,
        color: foilColor,
        backgroundColor: "#171814",
        padding: "4px 8px",
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: 1.4,
        display: "flex",
      }, "CORNER FILE / FOIL ISSUE"),
      h("div", {
        position: "absolute",
        right: -32,
        bottom: 73,
        width: 150,
        height: 1,
        backgroundColor: foilColor,
        transform: "rotate(-45deg)",
        opacity: 0.55,
        display: "flex",
      }),
    ] : []),
  ]);
}

const UNITLESS = new Set([
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "flex",
  "flexGrow",
  "flexShrink",
  "zIndex",
]);

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function serializeStyle(style: Style): string {
  return Object.entries(style)
    .map(([key, value]) => {
      const serialized =
        typeof value === "number" && value !== 0 && !UNITLESS.has(key) ? `${value}px` : String(value);
      return `${kebab(key)}:${serialized}`;
    })
    .join(";");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serializeNode(node: CardChild): string {
  if (node === null) return "";
  if (typeof node === "string" || typeof node === "number") return escapeHtml(String(node));
  const { children, style, ...props } = node.props;
  const attributes = Object.entries(props)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => ` ${key === "className" ? "class" : key}="${escapeHtml(String(value))}"`)
    .join("");
  const childList = Array.isArray(children) ? children : children === undefined ? [] : [children];
  return `<${node.type}${style ? ` style="${escapeHtml(serializeStyle(style))}"` : ""}${attributes}>${
    childList.map(serializeNode).join("")
  }</${node.type}>`;
}

export function cardHtmlDocument(
  verdict: Verdict,
  stats: Stats,
  excerpts: Excerpt[],
  fontDataUrls?: { regular: string; bold: string },
): string {
  const fonts = fontDataUrls
    ? `@font-face{font-family:Inter;src:url("${fontDataUrls.regular}") format("truetype");font-weight:400}` +
      `@font-face{font-family:Inter;src:url("${fontDataUrls.bold}") format("truetype");font-weight:700}`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${CARD_WIDTH}">` +
    `<title>Model Citizen conduct record</title><style>${fonts}*{box-sizing:border-box}html,body{margin:0;width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;background:${BASE}}</style>` +
    `</head><body>${serializeNode(cardTemplate(verdict, stats, excerpts))}</body></html>`;
}
