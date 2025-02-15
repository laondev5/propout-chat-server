import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";
import mongoose from "mongoose";
import axios from "axios";
import connectDB from "./config/db.js";
import requestRoutes from "./routes/requestRoutes.js";
import MessageModel from "./model/Messages.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();
const httpServer = createServer(app);

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://www.mypropout.com",
      "https://mypropout.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    credentials: true,
  })
);

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log("\n=== Incoming Request ===");
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`Original URL: ${req.originalUrl}`);
  console.log(`Base URL: ${req.baseUrl}`);
  console.log(`Path: ${req.path}`);
  console.log("Headers:", req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", req.body);
  }
  console.log("=====================\n");
  next();
});

// Force JSON responses
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// Mount API routes
const apiRouter = express.Router();
app.use("/api", apiRouter);

// Test route
apiRouter.get("/test", (req, res) => {
  res.json({ message: "API is working" });
});

// Mount property request routes
apiRouter.use("/", requestRoutes);

// Debug route to list all registered routes
apiRouter.get("/routes", (req, res) => {
  const routes = [];

  // Get routes from the main app
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
      });
    }
  });

  // Get routes from the API router
  apiRouter.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: `/api${middleware.route.path}`,
        methods: Object.keys(middleware.route.methods),
      });
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: `/api${handler.route.path}`,
            methods: Object.keys(handler.route.methods),
          });
        }
      });
    }
  });

  res.json({
    routes,
    requestUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
  });
});

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

// User Storage and Management
let globalUsers = [];
const onlineUsers = new Map();

// Fetch Users Function
async function fetchUsers() {
  try {
    const response = await axios.get(
      "https://proput-db-4vtf.onrender.com/all_users"
    );
    globalUsers = response.data.user;
    return globalUsers;
  } catch (error) {
    console.error("Error fetching users:", error.message);
    return [];
  }
}

// User Lookup Helper
function findUserById(userId) {
  const numericUserId = Number(userId);
  return globalUsers.find((user) => user.id === numericUserId);
}

// Periodic User Refresh
setInterval(fetchUsers, 5 * 60 * 1000); // Refresh every 5 minutes
fetchUsers(); // Initial Fetch

// Socket Connection Handler
io.on("connection", (socket) => {
  socket.on("user_join", async (userId) => {
    if (globalUsers.length === 0) {
      await fetchUsers();
    }

    const user = findUserById(userId);
    if (user) {
      onlineUsers.set(userId, socket.id);
      io.emit("user_status", {
        userId,
        status: "online",
        userDetails: user,
      });
    } else {
      await fetchUsers();
      const retryUser = findUserById(userId);
      if (retryUser) {
        onlineUsers.set(userId, socket.id);
        io.emit("user_status", {
          userId,
          status: "online",
          userDetails: retryUser,
        });
      }
    }
  });

  socket.on("send_message", async (messageData) => {
    try {
      const sender = findUserById(messageData.senderId);
      const receiver = findUserById(messageData.receiverId);

      if (!sender || !receiver) {
        return socket.emit("message_error", {
          error: "Invalid sender or receiver",
          details: {
            senderId: messageData.senderId,
            receiverId: messageData.receiverId,
          },
        });
      }

      if (!messageData.content || messageData.content.trim() === "") {
        return socket.emit("message_error", {
          error: "Message content cannot be empty",
        });
      }

      const message = new MessageModel({
        senderId: Number(messageData.senderId),
        receiverId: Number(messageData.receiverId),
        content: messageData.content,
        senderName: sender.name,
        receiverName: receiver.name,
        timestamp: new Date(),
      });

      const savedMessage = await message.save({
        timeout: 20000,
      });

      const receiverSocketId = onlineUsers.get(messageData.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive_message", {
          ...savedMessage.toObject(),
          senderDetails: sender,
        });
      }

      socket.emit("message_sent", {
        ...savedMessage.toObject(),
        senderDetails: sender,
        receiverDetails: receiver,
      });
    } catch (error) {
      console.error("Error handling message:", error);
      socket.emit("message_error", {
        error: "Failed to process message",
        details: error.message,
      });
    }
  });

  socket.on("disconnect", () => {
    const userId = [...onlineUsers.entries()].find(
      ([_, socketId]) => socketId === socket.id
    )?.[0];
    if (userId) {
      onlineUsers.delete(userId);
      io.emit("user_status", {
        userId,
        status: "offline",
      });
    }
  });
});

// Route not found handler (404)
app.use((req, res) => {
  console.log(`\n=== 404 Error ===`);
  console.log(`Route not found: ${req.method} ${req.originalUrl}`);
  console.log(`Base URL: ${req.baseUrl}`);
  console.log(`Path: ${req.path}`);
  console.log(`Request body:`, req.body);
  console.log(`Request headers:`, req.headers);

  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestInfo: {
      url: req.originalUrl,
      baseUrl: req.baseUrl,
      path: req.path,
      method: req.method,
    },
    availableRoutes: [
      { method: "POST", path: "/api/property-request" },
      { method: "GET", path: "/api/property-requests" },
      { method: "GET", path: "/api/property-request/:id" },
      { method: "PUT", path: "/api/property-request/:id" },
      { method: "DELETE", path: "/api/property-request/:id" },
    ],
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("\n=== Server Error ===");
  console.error("Error:", err);
  console.error("Request URL:", req.originalUrl);
  console.error("Base URL:", req.baseUrl);
  console.error("Path:", req.path);
  console.error("Method:", req.method);
  console.error("Body:", req.body);
  console.error("==================\n");

  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
    error: {
      type: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log("\n=== Server Started ===");
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);

  // Log all registered routes
  console.log("\nRegistered Routes:");
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(
        `${Object.keys(middleware.route.methods)[0].toUpperCase()} ${
          middleware.route.path
        }`
      );
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          console.log(
            `${Object.keys(handler.route.methods)[0].toUpperCase()} /api${
              handler.route.path
            }`
          );
        }
      });
    }
  });
  console.log("=====================\n");
});
