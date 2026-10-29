import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (items) =>
          items.length === 4 &&
          items.every((item) => typeof item === "string" && item.trim().length > 0),
        message: "Each question must have exactly four non-empty options"
      }
    },
    correctOption: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    },
    points: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    }
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    courseCode: {
      type: String,
      trim: true,
      maxlength: 30,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 180,
      default: 15
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "A quiz must contain at least one question"
      }
    },
    isPublished: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export default mongoose.model("Quiz", quizSchema);
