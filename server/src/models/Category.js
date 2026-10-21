import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 80 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

categorySchema.index({ isActive: 1, name: 1 });
export default mongoose.model("Category", categorySchema);
