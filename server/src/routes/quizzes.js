import { Router } from "express";
import Quiz from "../models/Quiz.js";
import Category from "../models/Category.js";
import { normalizeSearch, parsePagination, toPublicQuiz } from "../services/catalog.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const paging = parsePagination(req.query);
    if (paging.error) return res.status(400).json({ message: paging.error });

    const filter = { isPublished: true };
    if (typeof req.query.category === "string" && req.query.category.trim()) {
      const category = await Category.findOne({
        slug: req.query.category.trim().toLowerCase(),
        isActive: true
      }).select("_id").lean();
      if (!category) return res.json({
        quizzes: [], pagination: { page: paging.page, limit: paging.limit, total: 0, pages: 0 }
      });
      filter.category = category._id;
    }

    const search = normalizeSearch(req.query.search);
    if (search) filter.title = { $regex: search, $options: "i" };

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter).populate({ path: "category", match: { isActive: true }, select: "name slug" })
        .sort({ publishedAt: -1, _id: 1 }).skip(paging.skip).limit(paging.limit).lean(),
      Quiz.countDocuments(filter)
    ]);

    const visible = quizzes.filter((quiz) => quiz.category);
    res.json({
      quizzes: visible.map(toPublicQuiz),
      pagination: { page: paging.page, limit: paging.limit, total, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:quizId", async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.quizId)) {
      return res.status(400).json({ message: "Invalid quiz ID" });
    }
    const quiz = await Quiz.findOne({ _id: req.params.quizId, isPublished: true })
      .populate({ path: "category", match: { isActive: true }, select: "name slug" }).lean();
    if (!quiz || !quiz.category) return res.status(404).json({ message: "Quiz not found" });
    res.json({ quiz: toPublicQuiz(quiz) });
  } catch (error) {
    next(error);
  }
});

export default router;
