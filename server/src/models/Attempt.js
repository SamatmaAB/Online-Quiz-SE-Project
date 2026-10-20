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
  questions: { type: [attemptQuestionSchema], required: true }
}, { timestamps: true });

attemptSchema.index({ user: 1, createdAt: -1 });
attemptSchema.index({ quiz: 1, createdAt: -1 });

export default mongoose.model("Attempt", attemptSchema);