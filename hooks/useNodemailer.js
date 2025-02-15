import nodemailer from "nodemailer";

// Create a transporter using Gmail credentials
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "mypropoutai@gmail.com",
    pass: "@Propout2023$",
  },
});

const useNodemailer = () => {
  const sendEmail = async ({ to, subject, formData }) => {
    try {
      // Create HTML content for the email
      const htmlContent = `
        <h2>New Property Request</h2>
        <p><strong>From:</strong> ${formData.name}</p>
        <p><strong>Email:</strong> ${formData.email}</p>
        <p><strong>Phone:</strong> ${formData.phone}</p>
        <p><strong>Property Type:</strong> ${formData.propertyType}</p>
        <p><strong>Location:</strong> ${formData.location}</p>
        <p><strong>Budget:</strong> ${formData.budget}</p>
        <p><strong>Additional Requirements:</strong></p>
        <p>${formData.message}</p>
      `;

      // Configure email options
      const mailOptions = {
        from: "mypropoutai@gmail.com",
        to: to,
        subject: subject,
        html: htmlContent,
      };

      // Send the email
      await transporter.sendMail(mailOptions);
      return { success: true, message: "Email sent successfully" };
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }
  };

  return {
    sendEmail,
  };
};

export default useNodemailer;
