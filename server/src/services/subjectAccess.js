import { createRequire } from "node:module";
import CustomSubject from "../models/CustomSubject.js";

const require = createRequire(import.meta.url);
export const builtInSubjects = require("../data/builtInSubjects.json");

/** Custom subject keys are "C" + a 24-char ObjectId; built-in keys never match. */
export const CUSTOM_KEY_PATTERN = /^C[0-9a-f]{24}$/;

export function customView(subject) {
  return {
    key: subject.key, name: subject.name, code: subject.code, courseType: subject.courseType,
    units: subject.units, isCustom: true
  };
}

export async function subjectForUser(subjectKey, userId) {
  if (builtInSubjects[subjectKey]) return { ...builtInSubjects[subjectKey], isCustom: false };
  if (!CUSTOM_KEY_PATTERN.test(subjectKey)) return null;
  const custom = await CustomSubject.findOne({ key: subjectKey, owner: userId }).lean();
  return custom ? customView(custom) : null;
}


export function isBuiltInSubjectKey(key) {
  return Boolean(key && Object.prototype.hasOwnProperty.call(builtInSubjects, String(key)));
}
