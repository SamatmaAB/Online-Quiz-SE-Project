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
});

router.post("/custom", requireAuth, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const courseType = typeof req.body?.courseType === "string" ? req.body.courseType.trim() : "";
    const syllabusText = typeof req.body?.syllabusText === "string" ? req.body.syllabusText.trim() : "";
    if (name.length < 2 || name.length > 100) return res.status(400).json({ message: "Subject name must be 2–100 characters" });
    if (code.length > 40 || courseType.length > 40) return res.status(400).json({ message: "Subject code and course type must be 40 characters or less" });
    if (syllabusText.length < 10 || syllabusText.length > 20000) return res.status(400).json({ message: "Add 10–20,000 characters of syllabus text" });
    const id = new mongoose.Types.ObjectId();
    const units = await parseSyllabusWithChints(syllabusText);
    const subject = await CustomSubject.create({
      _id: id, key: `C${id}`, owner: req.user.id, name, code, courseType, syllabusText,
      units
    });
    try { await setState(req.user.id, subject.key, "enrolled"); }
    catch (error) {
      await CustomSubject.deleteOne({ _id: subject._id, owner: req.user.id });
      throw error;
    }
    res.status(201).json({ subject: { ...customView(subject.toObject()), status: "enrolled" } });
  } catch (error) { next(error); }
});

router.post("/hidden/unlock", requireAuth, async (req, res, next) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = await User.findById(req.user.id).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Incorrect password" });
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(500).json({ message: "Authentication is not configured" });
    const accessToken = jwt.sign(
      { sub: req.user.id, scope: "hidden-subjects", nonce: randomBytes(8).toString("hex") },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
    res.json({ accessToken, subjects: await subjectsForUser(req.user.id, { hiddenOnly: true }) });
  } catch (error) { next(error); }
});

router.get("/hidden", requireAuth, hiddenAccess, async (req, res, next) => {
  try { res.json({ subjects: await subjectsForUser(req.user.id, { hiddenOnly: true }) }); }
  catch (error) { next(error); }
});

router.patch("/hidden/:subjectKey/restore", requireAuth, hiddenAccess, async (req, res, next) => {
  try {
    const subject = await subjectForUser(req.params.subjectKey, req.user.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    const enrollment = await SubjectEnrollment.findOne({ user: req.user.id, subjectKey: subject.key });
    if (!enrollment || enrollment.status !== "hidden") return res.status(404).json({ message: "Hidden subject not found" });
    enrollment.status = enrollment.restoreStatus || "available";
    await enrollment.save();
    res.json({ status: enrollment.status });
  } catch (error) { next(error); }
});

router.patch("/:subjectKey/state", requireAuth, async (req, res, next) => {
  try {
    const subject = await subjectForUser(req.params.subjectKey, req.user.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    const status = req.body?.status;
    if (!allowedStates.has(status)) return res.status(400).json({ message: "Choose enrolled, dropped, or hidden" });
    const current = await SubjectEnrollment.findOne({ user: req.user.id, subjectKey: subject.key }).lean();
    if (status === "hidden" && current?.status === "hidden") return res.json({ status: "hidden" });
    const restoreStatus = status === "hidden" ? (current?.status || "available") : undefined;
    const saved = await setState(req.user.id, subject.key, status, restoreStatus);
    res.json({ status: saved.status });
  } catch (error) { next(error); }
});

router.post("/custom/:subjectKey/reparse", requireAuth, async (req, res, next) => {
  try {
    const subject = await CustomSubject.findOne({ key: req.params.subjectKey, owner: req.user.id });
    if (!subject) return res.status(404).json({ message: "Custom subject not found" });
    subject.units = await parseSyllabusWithChints(subject.syllabusText);
    await subject.save();
    res.json({ subject: { ...customView(subject.toObject()), status: "enrolled" } });
  } catch (error) { next(error); }
});

router.delete("/custom/:subjectKey", requireAuth, async (req, res, next) => {
  try {
    const key = req.params.subjectKey;
    const subject = await CustomSubject.findOne({ key, owner: req.user.id });
    if (!subject) return res.status(404).json({ message: "Custom subject not found" });
    await Promise.all([
      Quiz.deleteMany({ subjectKey: key, createdBy: req.user.id }),
      SubjectEnrollment.deleteMany({ subjectKey: key }),
      subject.deleteOne()
    ]);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get("/:subjectKey", requireAuth, async (req, res, next) => {
  try {
    const result = await requireEnrolled(req.params.subjectKey, req.user.id);
    if (!result.subject) return res.status(result.status).json({ message: result.error });
    res.json({ subject: result.subject });
  } catch (error) { next(error); }
});

export default router;
