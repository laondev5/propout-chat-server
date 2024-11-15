import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: Number, // Change to Number if user IDs are numeric
      required: [true, "Sender ID is required"],
    },
    receiverId: {
      type: Number, // Change to Number if user IDs are numeric
      required: [true, "Receiver ID is required"],
    },
    senderName: {
      type: String,
      required: [true, "Sender name is required"],
    },
    receiverName: {
      type: String,
      required: [true, "Receiver name is required"],
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [1000, "Message cannot be more than 1000 characters"],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // This adds createdAt and updatedAt fields
  }
);

const MessageModel = mongoose.model("Message", MessageSchema);
export default MessageModel;
