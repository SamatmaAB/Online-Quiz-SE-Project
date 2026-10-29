import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    }
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
