import { Router } from "express";
import Category from "../models/Category.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name slug description")
      .sort({ name: 1 })
      .lean();
    res.json({ categories: categories.map(({ _id, name, slug, description }) => ({
      id: String(_id), name, slug, description
    })) });
  } catch (error) {
    next(error);
  }
});

export default router;
