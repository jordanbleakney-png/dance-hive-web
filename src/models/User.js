import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  parentName: { type: String },
  email: { type: String, required: true, unique: true },
  parentPhone: { type: String },
  childName: { type: String },
  age: { type: String },
  password: { type: String },
  role: {
    type: String,
    enum: ["customer", "member", "teacher", "admin"],
    default: "customer",
  },
  membership: {
    status: { type: String, default: "none" },
    plan: { type: String, default: null },
    startedAt: { type: Date, default: null },
  },
});

export default mongoose.models.User || mongoose.model("User", UserSchema);
