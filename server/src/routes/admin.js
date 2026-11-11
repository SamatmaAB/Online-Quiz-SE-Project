import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Quiz from "../models/Quiz.js";
import Attempt from "../models/Attempt.js";
import Category from "../models/Category.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { slugify } from "../services/questions.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/overview", async (_req, res, next) => {
  try {
    const [users, admins, published, drafts, attempts, categories, scoreAgg] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      Quiz.countDocuments({ isPublished: true }),
      Quiz.countDocuments({ isPublished: false }),
      Attempt.countDocuments({ status: { $ne: "in-progress" } }),
      Category.countDocuments({ isActive: true }),
      Attempt.aggregate([{ $match: { status: { $ne: "in-progress" } } }, { $group: { _id: null, average: { $avg: "$percentage" } } }])
    ]);
    res.json({ users, admins, quizzes: { published, drafts }, attempts, categories, averageScore: Math.round((scoreAgg[0]?.average ?? 0) * 10) / 10 });
  } catch (error) { next(error); }
});

router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(300).lean();
    res.json({ users: users.map((user) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })) });
  } catch (error) { next(error); }
});

router.patch("/users/:userId/role", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user identifier" });
    const role = req.body?.role;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "Role must be user or admin" });
    if (req.params.userId === req.user.id && role !== "admin") return res.status(400).json({ message: "You can't remove your own admin access" });
    const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
});

router.get("/categories", async (_req, res, next) => {
  try {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Quiz.aggregate([{ $group: { _id: "$category", total: { $sum: 1 } } }])
    ]);
    const countById = new Map(counts.map((entry) => [String(entry._id), entry.total]));
    res.json({
      categories: categories.map((category) => ({
        id: String(category._id), name: category.name, slug: category.slug, description: category.description,
        isActive: category.isActive, quizCount: countById.get(String(category._id)) || 0
      }))
    });
  } catch (error) { next(error); }
});

router.post("/categories", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 500) : "";
    const slug = slugify(name);
    if (name.length < 2 || name.length > 80 || !slug) return res.status(400).json({ message: "Category name must be 2–80 characters" });
    if (await Category.exists({ $or: [{ slug }, { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] })) {
      return res.status(409).json({ message: "A category with that name already exists" });
    }
    const category = await Category.create({ name, slug, description });
    res.status(201).json({ category: { id: category.id, name: category.name, slug: category.slug, description: category.description, isActive: category.isActive, quizCount: 0 } });
  } catch (error) { next(error); }
});

router.patch("/categories/:categoryId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.categoryId)) return res.status(400).json({ message: "Invalid category identifier" });
    const updates = {};
    if (typeof req.body?.isActive === "boolean") updates.isActive = req.body.isActive;
    if (typeof req.body?.description === "string") updates.description = req.body.description.trim().slice(0, 500);
    if (!Object.keys(updates).length) return res.status(400).json({ message: "Provide isActive or description" });
    const category = await Category.findByIdAndUpdate(req.params.categoryId, updates, { new: true });
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json({ category: { id: category.id, name: category.name, slug: category.slug, description: category.description, isActive: category.isActive } });
  } catch (error) { next(error); }
});

export default router;

