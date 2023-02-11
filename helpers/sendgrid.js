require("dotenv").config();
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendMail({ to, subject, html }) {
    const email = {
      from: "nikolaj.jeliba@gmail.com",
      to,
      subject,
      html,
    };

    try {
      await sgMail.send(email)
      console.log("Email sent", email);
    } catch (error) {
      console.error("No sending with SendGrid", error);
    }
  }

module.exports = {
    sendMail,
  } 



