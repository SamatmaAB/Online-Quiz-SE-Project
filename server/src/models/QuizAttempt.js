import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    selectedOption: {
      type: Number,
      min: 0,
      max: 3
    }
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true
    },
    answers: {
      type: [answerSchema],
      default: []
    },
    score: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPoints: {
      type: Number,
      required: true,
      min: 1
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    deadline: {
      type: Date,
      required: true
    },
    submittedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ["in-progress", "submitted", "expired"],
      default: "in-progress"
    }
  },
  { timestamps: true }
);

quizAttemptSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("QuizAttempt", quizAttemptSchema);
