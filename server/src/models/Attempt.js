import mongoose from "mongoose";

const attemptQuestionSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  prompt: { type: String, required: true },
  options: { type: [String], required: true },
  correctOption: { type: Number, required: true },
  selectedOption: { type: Number, default: null }
}, { _id: false });

const attemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
  quizTitle: { type: String, required: true },
  category: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
  durationMinutes: { type: Number, required: true },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: true },
  submittedAt: { type: Date, default: null },
  status: { type: String, enum: ["in-progress", "submitted", "timed-out"], default: "in-progress", index: true },
  questions: { type: [attemptQuestionSchema], required: true },
  score: { type: Number, default: null },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, default: null }
}, { timestamps: true });

attemptSchema.index({ user: 1, createdAt: -1 });
attemptSchema.index({ quiz: 1, createdAt: -1 });

export default mongoose.model("Attempt", attemptSchema);
