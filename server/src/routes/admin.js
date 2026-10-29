import { Router } from "express";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Quiz from "../models/Quiz.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireAdmin);

// View all categories
router.get("/categories", async (_req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// Add a category
router.post("/categories", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: "Category name must be 2–60 characters" });
    }

    if (description.length > 300) {
      return res.status(400).json({ message: "Description must not exceed 300 characters" });
    }

    const category = await Category.create({ name, description });
    res.status(201).json({ message: "Category created", category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A category with this name already exists" });
    }
    next(error);
  }
});

// Edit a category
router.patch("/categories/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = String(req.body.name).trim();
      if (updates.name.length < 2 || updates.name.length > 60) {
        return res.status(400).json({ message: "Category name must be 2–60 characters" });
      }
    }

    if (req.body.description !== undefined) {
      updates.description = String(req.body.description).trim();
      if (updates.description.length > 300) {
        return res.status(400).json({ message: "Description must not exceed 300 characters" });
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "Provide a name or description to update" });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!category) return res.status(404).json({ message: "Category not found" });

    res.json({ message: "Category updated", category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A category with this name already exists" });
    }
    next(error);
  }
});

// Delete a category
router.delete("/categories/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    const Quiz = (await import("../models/Quiz.js")).default;
    const quizzesUsingCategory = await Quiz.exists({ category: category._id });

    if (quizzesUsingCategory) {
      return res.status(409).json({
        message: "This category is used by quizzes. Move or delete those quizzes first."
      });
    }

    await category.deleteOne();
    res.json({ message: "Category deleted" });
  } catch (error) {
    next(error);
  }
});
// Create a quiz (admin only)
router.post("/quizzes", async (req, res, next) => {
  try {
    const {
      title,
      courseCode = "",
      description = "",
      category,
      durationMinutes = 15,
      questions,
      isPublished = false
    } = req.body;

    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({
        message: "Quiz title must contain at least 2 characters"
      });
    }

    if (!mongoose.isValidObjectId(category)) {
      return res.status(400).json({
        message: "A valid category ID is required"
      });
    }

    const categoryExists = await Category.exists({ _id: category });

    if (!categoryExists) {
      return res.status(400).json({
        message: "Selected category does not exist"
      });
    }

    if (
      !Number.isInteger(Number(durationMinutes)) ||
      Number(durationMinutes) < 1 ||
      Number(durationMinutes) > 180
    ) {
      return res.status(400).json({
        message: "Duration must be between 1 and 180 minutes"
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: "Add at least one question"
      });
    }

    for (const question of questions) {
      if (
        !question.prompt ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        question.options.some(
          (option) => typeof option !== "string" || !option.trim()
        ) ||
        !Number.isInteger(question.correctOption) ||
        question.correctOption < 0 ||
        question.correctOption > 3
      ) {
        return res.status(400).json({
          message:
            "Each question needs text, four non-empty options, and a correct option numbered 0–3"
        });
      }
    }

    const quiz = await Quiz.create({
      title: String(title).trim(),
      courseCode,
      description,
      category,
      durationMinutes: Number(durationMinutes),
      questions,
      isPublished: Boolean(isPublished)
    });

    res.status(201).json({
      message: "Quiz created successfully",
      quiz
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid quiz data",
        details: error.message
      });
    }

    next(error);
  }
});

export default router;
