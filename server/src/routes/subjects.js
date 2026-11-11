import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import CustomSubject from "../models/CustomSubject.js";
import SubjectEnrollment from "../models/SubjectEnrollment.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { looksUnsplit, parseSyllabus, parseSyllabusWithChints } from "../services/subjects.js";
import Quiz from "../models/Quiz.js";
import { builtInSubjects, customView, subjectForUser } from "../services/subjectAccess.js";

const router = Router();
const allowedStates = new Set(["enrolled", "dropped", "hidden"]);

function hiddenAccess(req, res, next) {
  try {
    const token = req.get("x-hidden-access-token") || "";
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.scope !== "hidden-subjects" || payload.sub !== req.user.id) {
      return res.status(401).json({ message: "Hidden subjects are locked" });
    }
    req.hiddenAccess = true;
    next();
  } catch {
    res.status(401).json({ message: "Hidden subjects are locked" });
  }
}

async function subjectsForUser(userId, { hiddenOnly = false } = {}) {
  const [enrollments, custom] = await Promise.all([
    SubjectEnrollment.find({ user: userId }).lean(),
    CustomSubject.find({ owner: userId }).sort({ name: 1 }).lean()
  ]);
  // Repair custom subjects saved by an older parser (unsplit paragraphs, "Unit - 1" topics, or collapsed units).
  for (const subject of custom) {
    if (looksUnsplit(subject.units, subject.syllabusText)) {
      subject.units = parseSyllabus(subject.syllabusText);
      await CustomSubject.updateOne({ _id: subject._id }, { $set: { units: subject.units } });
    }
  }
  const stateByKey = new Map(enrollments.map((entry) => [entry.subjectKey, entry]));
  const list = [
    ...Object.values(builtInSubjects),
    ...custom.map(customView)
  ].map((subject) => {
    const enrollment = stateByKey.get(subject.key);
    return { ...subject, status: enrollment?.status || "available" };
  });
  return list.filter((subject) => hiddenOnly ? subject.status === "hidden" : subject.status !== "hidden");
}

async function requireEnrolled(subjectKey, userId) {
  const subject = await subjectForUser(subjectKey, userId);
  if (!subject) return { error: "Subject not found", status: 404 };
  const enrollment = await SubjectEnrollment.findOne({ user: userId, subjectKey }).lean();
  if (enrollment?.status !== "enrolled") return { error: "Enroll in this subject to open its syllabus", status: 403 };
  return { subject: { ...subject, status: "enrolled" } };
}

async function setState(userId, subjectKey, status, restoreStatus) {
  const $set = { status };
  if (restoreStatus) $set.restoreStatus = restoreStatus;
  return SubjectEnrollment.findOneAndUpdate(
    { user: userId, subjectKey },
    { $set },
    { upsert: true, new: true, runValidators: true }
  );
}

router.get("/", requireAuth, async (req, res, next) => {
  try { res.json({ subjects: await subjectsForUser(req.user.id) }); }
  catch (error) { next(error); }
});

router.post("/preview", requireAuth, async (req, res, next) => {
  try {
    const syllabusText = typeof req.body?.syllabusText === "string" ? req.body.syllabusText.trim() : "";
    if (syllabusText.length < 10 || syllabusText.length > 20000) {
      return res.status(400).json({ message: "Add 10–20,000 characters of syllabus text" });
    }
    const units = await parseSyllabusWithChints(syllabusText);
    res.json({ units });
  } catch (error) { next(error); }
// Stage 1
