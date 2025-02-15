import express from "express";
import {
  createRequest,
  getAllRequests,
  getRequest,
  updateRequest,
  deleteRequest,
} from "../controllers/requestController.js";
import useNodemailer from "../hooks/useNodemailer.js";

const router = express.Router();

// Debug middleware to log route registration
router.use((req, res, next) => {
  console.log(`Route handler called: ${req.method} ${req.originalUrl}`);
  next();
});

// Create new request
router.post("/property-request", async (req, res) => {
  try {
    console.log("\n=== Processing Property Request ===");
    console.log("Received property request:", req.body);
    console.log("Request URL:", req.originalUrl);
    console.log("Request method:", req.method);

    // Validate required fields
    const { name, email, phone, propertyType, budget, location } = req.body;

    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!email) missingFields.push("email");
    if (!phone) missingFields.push("phone");
    if (!propertyType) missingFields.push("propertyType");
    if (!budget) missingFields.push("budget");
    if (!location) missingFields.push("location");

    if (missingFields.length > 0) {
      console.log("Validation failed - Missing fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    console.log("Validation passed, processing request...");

    // 1. Create the request in database
    const result = await createRequest(req.body);
    console.log("Request saved to database:", result);

    // 2. Send email notification
    try {
      const { sendEmail } = useNodemailer();
      await sendEmail({
        to: "mypropoutai@gmail.com",
        subject: "New Property Request",
        formData: req.body,
      });
      console.log("Email notification sent successfully");
    } catch (emailError) {
      console.error("Error sending email notification:", emailError);
      // Continue with the request even if email fails
    }

    console.log("Request processing completed successfully");

    // Send success response
    return res.status(201).json({
      success: true,
      message: "Property request submitted successfully",
      data: result,
    });
  } catch (error) {
    console.error("\n=== Route Error ===");
    console.error("Error processing property request:", error);
    console.error("Stack trace:", error.stack);
    console.error("=====================\n");

    return res.status(500).json({
      success: false,
      message: "Failed to process property request",
      error: {
        message: error.message,
        type: error.name,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    });
  }
});

// Get all requests
router.get("/property-requests", getAllRequests);

// Get single request
router.get("/property-request/:id", getRequest);

// Update request
router.put("/property-request/:id", updateRequest);

// Delete request
router.delete("/property-request/:id", deleteRequest);

// Log registered routes
console.log("\n=== Registered Routes ===");
router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(
      `${Object.keys(r.route.methods)[0].toUpperCase()} /api${r.route.path}`
    );
  }
});
console.log("=====================\n");

export default router;
