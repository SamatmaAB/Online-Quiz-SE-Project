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
export function splitTopicLine(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text || standaloneUnitMarker.test(text)) return [];
  const rawPieces = [];
  let depth = 0;
  let buffer = "";
  const flush = () => {
    for (const part of splitEmbeddedHeadings(buffer)) {
      if (part.length >= 2 && !standaloneUnitMarker.test(part)) rawPieces.push(part);
    }
    buffer = "";
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const prev = text[i - 1] || "";
      const next = text[i + 1] || "";
      const betweenDigits = /\d/.test(prev) && /\d/.test(next);
      const sentenceDot =
        ch === "." &&
        next === " " &&
        /[A-Z]/.test(text[i + 2] || "") &&
        !/\b(?:e\.g|i\.e|vs|etc|dr|mr|mrs|fig|no|st|ch)$/i.test(buffer.trim());

      if (
        ch === ";" ||
        ch === "•" ||
        ch === "|" ||
        ch === "–" ||
        ch === "—" ||
        sentenceDot ||
        (ch === "," && !betweenDigits) ||
        (ch === "-" && prev === " " && next === " ")
      ) {
        flush();
        continue;
      }
    }
    buffer += ch;
  }
  flush();

  // Short lines are only split when they clearly are lists (3+ items); "Process concept, states" stays whole.
  if (text.length <= LONG_LINE && rawPieces.length < 3 && !/[;•|]/.test(text)) {
    const single = cleanTopic(text);
    return single && !standaloneUnitMarker.test(single) ? [single] : [];
  }

  // Post-process fragments for context clarity (e.g. "Single and Double" after "Circular Linked List").
  const refined = [];
  for (let i = 0; i < rawPieces.length; i += 1) {
    let item = rawPieces[i];
    const prev = refined[refined.length - 1] || "";
    if (/^single\s+and\s+double$/i.test(item) && /linked\s+list/i.test(prev)) {
      item = "Single and Double Ended Linked Lists";
    } else if (/^case\s+study$/i.test(item) && rawPieces[i + 1]) {
      item = `Case Study: ${rawPieces[i + 1]}`;
      i += 1;
    } else if (/: case study$/i.test(item) && rawPieces[i + 1] && rawPieces[i + 1].length < 40) {
      item = `${item} (${rawPieces[i + 1]})`;
      i += 1;
    }
    refined.push(item);
  }
  return refined;
}

function extractTopicNames(lines) {
  const seen = new Set();
  const names = [];
  for (const line of lines) {
    for (const topic of splitTopicLine(line)) {
      const key = topic.toLowerCase();
      if (seen.has(key) || standaloneUnitMarker.test(topic)) continue;
      seen.add(key);
      names.push(topic);
    }
  }
  return names;
}

/**
 * Generates a concise, helpful 1-sentence study description for a syllabus topic so custom
 * subjects have meaningful descriptions and Chints can craft specific MCQs even offline.
 */
export function describeTopic(topicName, unitName = "") {
  const name = String(topicName || "").trim();
  const lower = name.toLowerCase();
  const unitClean = String(unitName || "").replace(/^Unit\s*\d+\s*:\s*/i, "").trim();

  if (name.includes(":")) {
    const [head, ...restParts] = name.split(":");
    const tail = restParts.join(":").trim();
    if (head && tail) {
      return `Covers ${tail} within ${head.trim()}, including its structure, operations, and practical implementation.`;
    }
  }
  if (/linked list/i.test(lower)) {
    return `Dynamic node-based linear data structure (${name}) covering pointer manipulation, insertion, deletion, and traversal complexity.`;
  }
  if (/stack/i.test(lower)) {
    return `LIFO (Last-In, First-Out) data structure concept (${name}) used for managing function calls, expressions, and backtracking.`;
  }
  if (/queue|dequeue/i.test(lower)) {
    return `FIFO / double-ended queue structure (${name}) for ordered scheduling, buffering, and cyclic or priority-based processing.`;
  }
  if (/infix|postfix|prefix|expression|parenthes/i.test(lower)) {
    return `Algorithmic technique for parsing, converting, and evaluating ${name} using operator precedence and stack frames.`;
  }
  if (/recursion|hanoi|josephus/i.test(lower)) {
    return `Problem-solving method using self-referential base and recursive cases to solve ${name} and analyze call-stack behavior.`;
  }
  if (/memory allocation|pointer|review of c/i.test(lower)) {
    return `Foundational systems programming concept (${name}) governing stack vs. heap layout, pointers, and runtime memory management.`;
  }
  if (/tree|bst|avl|heap|trie/i.test(lower)) {
    return `Hierarchical non-linear data structure (${name}) supporting logarithmic search, traversal orders, and balanced updates.`;
  }
  if (/graph|bfs|dfs|dijkstra|spanning/i.test(lower)) {
    return `Vertex-and-edge network representation (${name}) for modeling connectivity, traversal paths, and shortest-path optimization.`;
  }
  if (/hash|skip list|sparse matrix|dictionary/i.test(lower)) {
    return `Space- and time-efficient indexing structure (${name}) designed for fast key lookup and compact representation.`;
  }
  if (/html|css|dom|web|http/i.test(lower)) {
    return `Core web platform standard (${name}) defining document structure, styling rules, client-server protocols, and browser rendering.`;
  }
  if (/react|hook|component|state|jsx|router/i.test(lower)) {
    return `Modern declarative UI pattern (${name}) for managing component state, lifecycle updates, and single-page navigation.`;
  }
  if (/node|express|mongo|rest|api|axios/i.test(lower)) {
    return `Full-stack application layer concept (${name}) for asynchronous data persistence, routing, and client-server communication.`;
  }
  return `Key syllabus topic${unitClean && unitClean !== "Full Syllabus" ? ` in ${unitClean}` : ""} covering the core principles, working mechanism, and applications of ${name}.`;
}

function buildAutoUnitName(section, topicNames) {
  if (!section.autoTitle || !topicNames.length) return section.name;
  const preview = topicNames
    .slice(0, 2)
    .map((t) => t.split(":")[0].replace(/\([^)]*\)/g, "").trim())
    .filter(Boolean)
    .join(" & ");
  return preview ? `Unit ${section.unitNum}: ${preview}`.slice(0, 160) : section.name;
}

export function parseSyllabus(text) {
  const sections = splitSyllabusSections(text);
  return sections.map((section) => {
    const names = extractTopicNames(section.lines).slice(0, 30);
    const unitName = buildAutoUnitName(section, names).slice(0, 160);
    return {
      name: unitName,
      topics: names.map((name) => ({
        name: name.slice(0, 160),
        description: describeTopic(name, unitName)
      }))
    };
  });
}

/**
 * True when a stored custom subject was parsed by an older parser:
 * - One giant topic per unit
 * - Any topic is literally "Unit - 1" / "Unit 1"
 * - Multiple units were collapsed into a single "Full Syllabus" unit
 * - Topics still have glued sentences ("A. B: C") or generic placeholder descriptions
 */
export function looksUnsplit(units = [], syllabusText = "") {
  if (!Array.isArray(units) || !units.length) return false;
  if (syllabusText && units.length === 1 && splitSyllabusSections(syllabusText).length > 1) return true;
  return units.some((unit) => {
    const topics = Array.isArray(unit?.topics) ? unit.topics : [];
    if (topics.length === 1 && topics[0].name.length > LONG_LINE) return true;
    return topics.some((t) =>
      standaloneUnitMarker.test(t?.name || "") ||
      /\.\s+[A-Z][a-z]+/.test(t?.name || "")
    );
  });
}

/**
 * Uses Chints (Gemini) to extract clean topics + 1-sentence definitions per unit,
 * trying fallback Gemini models if the primary model is busy (503/429), and falling
 * back to our local Chints syllabus analyzer if offline.
 */
export async function parseSyllabusWithChints(text) {
  const localUnits = parseSyllabus(text);
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) return localUnits;

  const sections = splitSyllabusSections(text);
  const unitsBlock = sections
    .map((sec, idx) => `UNIT ${idx + 1} ("${localUnits[idx]?.name || sec.name}"):\n${sec.lines.join("\n").slice(0, 2000)}`)
    .join("\n\n");

  const prompt = `Below are ${sections.length} unit(s) from a college course syllabus.
For EACH unit:
1. Give a clean unit title ("Unit 1: <concise title>").
2. Extract a clean list of the distinct individual topics covered in that unit (never combine two topics into one item, and never include "Unit 1" as a topic).
3. Write a concise one-sentence academic definition/description for each topic suitable for exam revision and MCQ generation.

${unitsBlock}

Return ONLY a JSON array with exactly ${sections.length} object(s) IN THE SAME ORDER:
[{"name": "Unit 1: ...", "topics": [{"name": "...", "description": "..."}]}]`;

  const models = [...new Set([process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"])];

  for (const model of models) {
    try {
      const reply = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(25_000)
      });
      if (!reply.ok) continue;
      const payload = await reply.json();
      const raw = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim());
      if (!Array.isArray(parsed) || parsed.length !== sections.length) continue;

      return sections.map((sec, idx) => {
        const aiUnit = parsed[idx] || {};
        const unitName = (typeof aiUnit.name === "string" && aiUnit.name.trim() ? aiUnit.name.trim() : localUnits[idx]?.name || sec.name).slice(0, 160);
        const items = Array.isArray(aiUnit.topics) ? aiUnit.topics : [];
        const cleaned = items
          .filter((t) => t && typeof t.name === "string" && t.name.trim() && !standaloneUnitMarker.test(t.name))
          .slice(0, 30)
          .map((t) => {
            const name = t.name.trim().slice(0, 160);
            const desc = String(t.description || t.def || "").trim();
            return {
              name,
              description: (desc && desc !== DEFAULT_DESCRIPTION ? desc : describeTopic(name, unitName)).slice(0, 1000)
            };
          });
        return {
          name: unitName,
          topics: cleaned.length ? cleaned : localUnits[idx].topics
        };
      });
    } catch {
      // Try next model or fall back to localUnits
    }
  }

  return localUnits;
}

export function countSyllabusTopics(units = []) {
  if (!Array.isArray(units)) return 0;
  return units.reduce((sum, u) => sum + (Array.isArray(u?.topics) ? u.topics.length : 0), 0);
}
