import Request from "../model/Request.js";
import nodemailer from "nodemailer";

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "mypropoutai@gmail.com",
    pass: "ycjcmmotwlauegou",
  },
});

// Email template function
const generateEmailHTML = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to right, #6B46C1, #4F46E5); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #6B46C1; }
    .value { margin-top: 5px; }
    .footer { margin-top: 20px; text-align: center; color: #666; font-size: 0.9em; }
    .highlight { background-color: #F3F4F6; padding: 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">New Property Request</h1>
      <p style="margin: 10px 0 0;">Received on ${new Date().toLocaleDateString()}</p>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Client Name:</div>
        <div class="value highlight">${data.name}</div>
      </div>
      <div class="field">
        <div class="label">Contact Information:</div>
        <div class="value">
          Email: ${data.email}<br>
          Phone: ${data.phone}
        </div>
      </div>
      <div class="field">
        <div class="label">Property Requirements:</div>
        <div class="value highlight">
          Type: ${data.propertyType}<br>
          Location: ${data.location}<br>
          Budget: ${data.budget}
        </div>
      </div>
      <div class="field">
        <div class="label">Additional Information:</div>
        <div class="value">${
          data.additionalInfo || "No additional information provided"
        }</div>
      </div>
      <div class="footer">
        <p>This is an automated message from PropOut Property Management System</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Create new request
export const createRequest = async (data) => {
  try {
    console.log("Creating new request with data:", data);

    // 1. Save to database
    const newRequest = await Request.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      propertyType: data.propertyType,
      budget: data.budget,
      location: data.location,
      additionalInfo: data.additionalInfo,
      status: "pending",
    });

    console.log("Request saved to database:", newRequest);

    // 2. Send email notification
    try {
      const mailOptions = {
        from: data.email,
        to: "mypropoutai@gmail.com",
        subject: "New Property Request",
        html: generateEmailHTML(data),
      };

      console.log("Sending email notification...");
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully");
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error("Error sending email:", emailError);
    }

    // 3. Return success response (as plain JSON)
    const responseData = {
      success: true,
      message: "Property request submitted successfully",
      data: {
        _id: newRequest._id,
        name: newRequest.name,
        email: newRequest.email,
        phone: newRequest.phone,
        propertyType: newRequest.propertyType,
        budget: newRequest.budget,
        location: newRequest.location,
        additionalInfo: newRequest.additionalInfo,
        status: newRequest.status,
        createdAt: newRequest.createdAt,
      },
    };

    console.log("Sending response:", responseData);
    return responseData;
  } catch (error) {
    console.error("Error in createRequest:", error);
    throw error;
  }
};

// Get all requests
export const getAllRequests = async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single request
export const getRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }
    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Update request
export const updateRequest = async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }
    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete request
export const deleteRequest = async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Request deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
