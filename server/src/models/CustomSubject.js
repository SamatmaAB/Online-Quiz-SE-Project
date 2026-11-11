import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1000, default: "" }
}, { _id: false });

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  topics: { type: [topicSchema], default: [] }
}, { _id: false });

const customSubjectSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  code: { type: String, trim: true, maxlength: 40, default: "" },
  courseType: { type: String, trim: true, maxlength: 40, default: "" },
  syllabusText: { type: String, required: true, maxlength: 20000 },
  units: { type: [unitSchema], default: [] }
}, { timestamps: true });

customSubjectSchema.index({ owner: 1, key: 1 }, { unique: true });
export default mongoose.model("CustomSubject", customSubjectSchema);
