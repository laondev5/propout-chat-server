import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import MessageModel from "./model/Messages.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://www.mypropout.com",
      "https://mypropout.com",
    ],
    credentials: true,
  })
);
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    retryWrites: true,
  })
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Add connection event listeners
mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

// User Storage
let globalUsers = [];

// Fetch Users Function
async function fetchUsers() {
  try {
    const response = await axios.get(
      "https://proput-db-jlb1.onrender.com/all_users"
    );

    // Specifically use response.data.user
    globalUsers = response.data.user;

    // console.log(
    //   "Fetched Users:",
    //   globalUsers.map((user) => ({
    //     id: user.id, // Use user.id instead of user._id
    //     name: user.name,
    //   }))
    // );

    //console.log(`Fetched ${globalUsers.length} users`);
    return globalUsers;
  } catch (error) {
    console.error("Error fetching users:", error.message);
    return [];
  }
}
// Periodic User Refresh
setInterval(fetchUsers, 5 * 60 * 1000); // Refresh every 5 minutes

// Initial Fetch
fetchUsers();

// User Lookup Helper
function findUserById(userId) {
  // Convert userId to string and ensure it's a number
  const numericUserId = Number(userId);

  // console.log(`Searching for user with ID: ${numericUserId}`);
  // console.log(`Total users: ${globalUsers.length}`);

  // Find user with exact id match
  const user = globalUsers.find((user) => user.id === numericUserId);

  if (user) {
    // console.log(`User found:`, {
    //   id: user.id,
    //   name: user.name,
    // });
    return user;
  }

  // console.warn(`No user found for ID: ${numericUserId}`);
  // console.log(
  //   "Available user IDs:",
  //   globalUsers.map((u) => u.id)
  // );

  return null;
}
// Socket.IO Configuration
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://www.mypropout.com",
      "https://mypropout.com",
    ],
    methods: ["GET", "POST"],
  },
});

// Online Users Tracking
const onlineUsers = new Map();

// Socket Connection Handler
io.on("connection", (socket) => {
  //console.log("New Client Connected:", socket.id);

  // User Join Event
  socket.on("user_join", async (userId) => {
    console.log(`User Join Attempt - User ID: ${userId}`);

    // Ensure users are fetched
    if (globalUsers.length === 0) {
      //console.log("No users loaded. Attempting to fetch...");
      await fetchUsers();
    }

    // Verify user exists
    const user = findUserById(userId);

    if (user) {
      onlineUsers.set(userId, socket.id);
      io.emit("user_status", {
        userId,
        status: "online",
        userDetails: user,
      });
      //console.log(`User ${userId} successfully joined`);
    } else {
      //console.log(`User not found: ${userId}`);

      // Attempt to refresh users and retry
      await fetchUsers();
      const retryUser = findUserById(userId);

      if (retryUser) {
        onlineUsers.set(userId, socket.id);
        io.emit("user_status", {
          userId,
          status: "online",
          userDetails: retryUser,
        });
        //console.log(`User ${userId} found after refresh`);
      } else {
        //console.error(`Persistent failure to find user: ${userId}`);
      }
    }
  });

  // Send Message Event
  socket.on("send_message", async (messageData) => {
    try {
      //console.log("Message Data Received:", messageData);

      // Validate sender and receiver
      const sender = findUserById(messageData.senderId);
      const receiver = findUserById(messageData.receiverId);

      // Log detailed connection information
      // console.log(
      //   "Online Users Map:",
      //   Array.from(onlineUsers.entries()).map(
      //     ([userId, socketId]) => `User ${userId}: ${socketId}`
      //   )
      // );

      if (!sender || !receiver) {
        // console.error("Invalid sender or receiver", {
        //   senderId: messageData.senderId,
        //   receiverId: messageData.receiverId,
        // });
        return socket.emit("message_error", {
          error: "Invalid sender or receiver",
          details: {
            senderId: messageData.senderId,
            receiverId: messageData.receiverId,
          },
        });
      }

      // Validate message content
      if (!messageData.content || messageData.content.trim() === "") {
        return socket.emit("message_error", {
          error: "Message content cannot be empty",
        });
      }

      // Create Message with explicit fields
      const message = new MessageModel({
        senderId: Number(messageData.senderId),
        receiverId: Number(messageData.receiverId),
        content: messageData.content,
        senderName: sender.name,
        receiverName: receiver.name,
        timestamp: new Date(),
      });

      // Save with extended timeout and error handling
      try {
        const savedMessage = await message.save({
          timeout: 20000, // Increase timeout to 20 seconds
        });

        // Find Receiver's Socket
        const receiverSocketId = onlineUsers.get(messageData.receiverId);

        // console.log("Receiver Socket Details:", {
        //   receiverId: messageData.receiverId,
        //   receiverSocketId: receiverSocketId,
        // });

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", {
            ...savedMessage.toObject(),
            senderDetails: sender,
          });
          // console.log(
          //   `Message sent to ${receiver.name}:`,
          //   savedMessage.content
          // );
        } else {
          //console.warn(`Receiver ${receiver.name} is not online`);
        }

        // Confirm to Sender
        socket.emit("message_sent", {
          ...savedMessage.toObject(),
          senderDetails: sender,
        });
      } catch (saveError) {
        //console.error("Message save failed:", saveError);
        socket.emit("message_error", {
          error: "Failed to save message",
          details: saveError.message,
          validationErrors: saveError.errors,
        });
      }
    } catch (error) {
      //console.error("Message sending process failed:", error);
      socket.emit("message_error", {
        error: "Message sending failed",
        details: error.message,
        stack: error.stack,
      });
    }
  });

  // Additional existing socket events...
});

// API Endpoint to get users
app.get("/api/users", async (req, res) => {
  try {
    // If users not fetched yet, fetch them
    if (globalUsers.length === 0) {
      await fetchUsers();
    }
    res.json(globalUsers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update Message Model to include more details
const MessageSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  senderName: {
    type: String,
  },
  receiverName: {
    type: String,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
});

// Start Server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  //console.log(`Server running on port ${PORT}`);
});
