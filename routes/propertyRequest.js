const express = require("express");
const router = express.Router();
const useNodemailer = require("../hooks/useNodemailer");

// Handle both endpoints for backward compatibility
router.post(
  ["/property-request", "/send-property-request"],
  async (req, res) => {
    try {
      console.log("Received property request:", req.body);

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
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      // Send email notification
      const { sendEmail } = useNodemailer();
      await sendEmail({
        to: "mypropoutai@gmail.com",
        subject: "New Property Request",
        formData: req.body,
      });

      res.status(201).json({
        success: true,
        message: "Property request submitted successfully",
        data: req.body,
      });
    } catch (error) {
      console.error("Error processing property request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process property request",
        error: error.message,
      });
    }
  }
);

module.exports = router;
