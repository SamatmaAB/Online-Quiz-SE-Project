import mongoose from "mongoose";

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
  durationMinutes: { type: Number, required: true, min: 1, max: 240, default: 15 },
  totalQuestions: { type: Number, required: true, min: 1, default: 10 },
  difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
  isPublished: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date, default: null }
}, { timestamps: true });

quizSchema.index({ isPublished: 1, publishedAt: -1 });
quizSchema.index({ title: "text", description: "text" });
export default mongoose.model("Quiz", quizSchema);
