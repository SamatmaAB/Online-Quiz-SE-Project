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
  category: { type: String, required: true, trim: true, minlength: 1, maxlength: 80, index: true },
  difficulty: { type: String, required: true, enum: ["easy", "medium", "hard"], index: true },
  durationMinutes: { type: Number, required: true, min: 1, max: 600 },
  questions: { type: [questionSchema], default: [] },
  isPublished: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

export default mongoose.model("Quiz", quizSchema);
