import mongoose from "mongoose";

const subjectEnrollmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subjectKey: { type: String, required: true, trim: true },
  status: { type: String, enum: ["enrolled", "dropped", "hidden"], required: true },
  restoreStatus: { type: String, enum: ["available", "enrolled", "dropped"], default: "available" }
}, { timestamps: true });

subjectEnrollmentSchema.index({ user: 1, subjectKey: 1 }, { unique: true });
export default mongoose.model("SubjectEnrollment", subjectEnrollmentSchema);
