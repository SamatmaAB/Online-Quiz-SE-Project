const unitHeading = /^\s*(?:unit|module|chapter)\s*(\d+)\s*[:.\-–]?\s*(.*)$/i;

export function splitSyllabusSections(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(unitHeading);
    if (heading) {
      current = { name: `Unit ${heading[1]}${heading[2] ? `: ${heading[2]}` : ""}`, lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line.replace(/^(?:[-*•]|\d+[.)])\s*/, ""));
    }
  }

  if (!sections.length) {
    sections.push({ name: "Full Syllabus", lines: lines.map((line) => line.trim()).filter(Boolean) });
  }
  return sections.slice(0, 40);
}

export function parseSyllabus(text) {
  return splitSyllabusSections(text).map((section) => ({
    name: section.name.slice(0, 160),
    topics: section.lines.slice(0, 30).map((line) => ({
      name: line.slice(0, 160),
      description: "From the syllabus you added."
    }))
  }));
}

/**
 * Uses Chints (Gemini) to extract clean topics + 1-sentence definitions per unit,
 * matching the original prototype's chints_parse_units(). Falls back to parseSyllabus()
 * if no GEMINI_API_KEY is configured or if the network call fails.
 */
export async function parseSyllabusWithChints(text) {
  const sections = splitSyllabusSections(text);
  const key = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  if (!key) return parseSyllabus(text);

  const unitsBlock = sections
    .map((sec) => `UNIT "${sec.name}":\n${sec.lines.join("\n").slice(0, 2000)}`)
    .join("\n\n");

  const prompt = `Below are units from a college course syllabus. For EACH unit, extract a clean list of the distinct topics covered (6-15 per unit) and write a concise one-sentence definition for each suitable for a student reviewing before an exam.

${unitsBlock}

Return ONLY a JSON array, one object per unit IN THE SAME ORDER as given above:
[{"topics": [{"name": "...", "description": "..."}]}]`;

  try {
    const reply = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(45_000)
    });
    if (!reply.ok) return parseSyllabus(text);
    const payload = await reply.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim());
    if (!Array.isArray(parsed) || parsed.length !== sections.length) return parseSyllabus(text);
    return sections.map((sec, idx) => {
      const items = Array.isArray(parsed[idx]?.topics) ? parsed[idx].topics : [];
      const cleaned = items
        .filter((t) => t && typeof t.name === "string" && t.name.trim())
        .slice(0, 30)
        .map((t) => ({
          name: t.name.trim().slice(0, 160),
          description: String(t.description || t.def || "From the syllabus you added.").trim().slice(0, 1000)
        }));
      return {
        name: sec.name.slice(0, 160),
        topics: cleaned.length ? cleaned : parseSyllabus(sec.lines.join("\n"))[0].topics
      };
    });
  } catch {
    return parseSyllabus(text);
  }
}

export function countSyllabusTopics(units = []) {
  if (!Array.isArray(units)) return 0;
  return units.reduce((sum, u) => sum + (Array.isArray(u?.topics) ? u.topics.length : 0), 0);
}
