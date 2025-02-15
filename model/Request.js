import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    propertyType: {
      type: String,
      required: [true, "Property type is required"],
      enum: ["apartment", "house", "condo", "townhouse"],
    },
    budget: {
      type: String,
      required: [true, "Budget is required"],
    },
    location: {
      type: String,
      required: [true, "Location is required"],
    },
    additionalInfo: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "contacted", "closed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Request", requestSchema);
