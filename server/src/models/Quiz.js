import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
  options: {
    type: [{ type: String, required: true, trim: true, minlength: 1, maxlength: 300 }],
    validate: { validator: (options) => options.length >= 2 && options.length <= 6, message: "Questions require 2–6 options" }
  },
  correctOption: { type: Number, required: true, min: 0 }
}, { timestamps: true });

questionSchema.pre("validate", function validateCorrectOption(next) {
  if (Number.isInteger(this.correctOption) && this.correctOption >= this.options.length) {
    this.invalidate("correctOption", "Correct option must refer to an available option");
  }
  next();
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard", "beginner", "intermediate", "advanced"], default: "beginner", required: true },
  durationMinutes: { type: Number, required: true, min: 1, max: 600, default: 15 },
  totalQuestions: { type: Number, required: true, min: 0, default: 0 },
  questions: { type: [questionSchema], default: [] },
  isPublished: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

quizSchema.index({ isPublished: 1, publishedAt: -1 });
quizSchema.index({ title: "text", description: "text" });
export default mongoose.model("Quiz", quizSchema);
