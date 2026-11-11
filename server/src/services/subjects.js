const ROMAN_TO_NUM = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10
};
const WORD_TO_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

const unitHeading = /^\s*(?:unit|module|chapter|part|section)\s*[:.\-–—#]*\s*(\d{1,2}|(?:x|ix|iv|v?i{1,3})|one|two|three|four|five|six|seven|eight)\b\s*[:.\-–—]*\s*(.*)$/i;
const standaloneUnitMarker = /^\s*(?:unit|module|chapter|part|section)\s*[:.\-–—#]*\s*(?:\d{1,2}|(?:x|ix|iv|v?i{1,3})|one|two|three|four|five|six|seven|eight)\s*$/i;

const DEFAULT_DESCRIPTION = "From the syllabus you added.";
const LONG_LINE = 60;

function parseUnitNumber(token) {
  const raw = String(token || "").trim().toLowerCase();
  if (/^\d+$/.test(raw)) return Number(raw);
  if (ROMAN_TO_NUM[raw]) return ROMAN_TO_NUM[raw];
  if (WORD_TO_NUM[raw]) return WORD_TO_NUM[raw];
  return token;
}

/**
 * Breaks inline "Unit - 2: ..." or "Unit 3 - ..." markers onto their own lines so syllabi
 * copied from PDFs or single-paragraph tables still split cleanly into separate units.
 */
function normalizeUnitBreaks(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/([.;\n]|,\s+|\s{2,})((?:unit|module|chapter)\s*[:.\-–—#]*\s*(?:\d{1,2}|(?:x|ix|iv|v?i{1,3}))\b)/gi, "$1\n$2");
}

function isTopicParagraph(rest) {
  if (!rest) return false;
  if (rest.length > 85) return true;
  const separators = (rest.match(/[;•]/g) || []).length;
  const commas = (rest.match(/,/g) || []).length;
  const periods = (rest.match(/\.\s+[A-Z]/g) || []).length;
  return separators >= 1 || periods >= 1 || commas >= 3;
}

export function splitSyllabusSections(text) {
  const normalized = normalizeUnitBreaks(text);
  const lines = normalized.split("\n");
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(unitHeading);
    if (heading) {
      const unitNum = parseUnitNumber(heading[1]);
      const rest = (heading[2] || "").trim().replace(/^[:.\-–—]+\s*/, "");
      if (isTopicParagraph(rest)) {
        current = { unitNum, name: `Unit ${unitNum}`, lines: [rest], autoTitle: true };
      } else {
        current = {
          unitNum,
          name: `Unit ${unitNum}${rest ? `: ${rest}` : ""}`,
          lines: [],
          autoTitle: !rest
        };
      }
      sections.push(current);
    } else if (current) {
      current.lines.push(line.replace(/^(?:[-*•]|\d+[.)])\s*/, ""));
    } else {
      // Content appeared before any explicit "Unit 1" heading; keep collecting until we see if a heading appears later.
      current = { unitNum: 1, name: "Full Syllabus", lines: [line.replace(/^(?:[-*•]|\d+[.)])\s*/, "")], implicit: true };
      sections.push(current);
    }
  }

  // If there was a leading implicit section AND real unit headings followed, merge leading lines into Unit 1 or drop empty implicit.
  if (sections.length > 1 && sections[0].implicit) {
    const first = sections.shift();
    if (first.lines.length) {
      sections[0].lines.unshift(...first.lines);
    }
  }

  if (!sections.length) {
    sections.push({ name: "Full Syllabus", lines: lines.map((line) => line.trim()).filter(Boolean) });
  }
  return sections.slice(0, 40);
}

function cleanTopic(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/^(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, "")
    .trim();
}

/**
 * Splits mid-sentence section labels that get glued together when copying from PDFs,
 * e.g. "Skip list Case study: Dictionary implementation using skip list Stacks: Basic structure of a Stack".
 * Only splits when a lowercase word or closing paren is followed by a distinct section header (not after
 * prepositions like "of"/"to" or title words like "Linked" in "Linked List:").
 */
function splitEmbeddedHeadings(segment) {
  const text = String(segment || "").trim();
  if (!text || !text.includes(":")) return [text];

  const broken = text.replace(
    /\b(?!(?:of|to|in|on|for|with|and|or|by|from|into|using)\b)([a-z]{3,}|\))\s+((?:Case\s+study|Applications\s+of\s+[A-Z][A-Za-z0-9 &/-]{1,24}|Conversion\s*&\s*Evaluation[^:]{0,30}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*:\s+)/g,
    "$1\n$2"
  );
  return broken.split("\n").map((s) => cleanTopic(s)).filter(Boolean);
}

/**
 * Splits one syllabus line into individual topics. University syllabi are usually written as a single
 * paragraph per unit ("A, B (c, d), E – F. G: H"), so long lines are split on top-level commas, semicolons,
 * sentence periods, bullets, spaced dashes, and embedded section headers. Separators inside brackets are kept.
 */
// Stage 1
