import { hash } from "./primitives";

/**
 * Confluence storage-format helpers. Page text is untrusted evidence: it is
 * reduced to plain text, bounded, and never interpreted as an instruction.
 */
const HEADING = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const decode = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export interface PageSection {
  /** Heading id attribute when present, otherwise the exact heading markup text. */
  anchor: string;
  heading: string;
  level: number;
  text: string;
}

/** List heading-delimited sections, bounded to 60 sections and 2,000 characters each. */
export function extractSections(body: string): PageSection[] {
  const headings = [...body.matchAll(HEADING)];
  return headings.slice(0, 60).map((match, index) => {
    const idAttr = /\bid="([^"]{1,200})"/i.exec(match[2] ?? "")?.[1];
    const start = match.index! + match[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    return {
      anchor: idAttr ? `id="${idAttr}"` : match[0],
      heading: decode(match[3] ?? "").slice(0, 240),
      level: Number(match[1]),
      text: decode(body.slice(start, end)).slice(0, 2000),
    };
  });
}

/**
 * Text of the section that starts at a unique anchor, up to the next heading.
 * Returns undefined when the anchor is absent or ambiguous.
 */
export function sectionText(body: string, anchor: string): string | undefined {
  const first = body.indexOf(anchor);
  if (first < 0 || body.indexOf(anchor, first + anchor.length) >= 0)
    return undefined;
  // If the anchor sits inside a heading, the section starts after that heading.
  const opener = body.lastIndexOf("<h", first);
  const inHeading =
    opener >= 0 &&
    /^<h[1-6]\b/i.test(body.slice(opener, opener + 3)) &&
    !/<\/h[1-6]>/i.test(body.slice(opener, first));
  const close = inHeading ? /<\/h[1-6]>/i.exec(body.slice(first)) : null;
  const from = close
    ? first + close.index + close[0].length
    : first + anchor.length;
  const next = /<h[1-6]\b/i.exec(body.slice(from));
  return decode(body.slice(from, next ? from + next.index : body.length));
}

/** Fingerprint of one section's normalized text, independent of other edits. */
export const sectionFingerprint = (
  pageId: string,
  anchor: string,
  text: string,
) => hash({ kind: "promisory.section.v1", pageId, anchor, text });

/** A stored section reference may be a bare heading id or an `id="..."` anchor. */
export const sameAnchor = (reference: string, anchor: string) =>
  reference === anchor ||
  anchor === `id="${reference}"` ||
  reference === `id="${anchor}"`;
