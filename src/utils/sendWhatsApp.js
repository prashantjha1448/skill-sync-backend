/**
 * @desc    Sends a WhatsApp notification alert (Placeholder for Twilio/Meta API)
 * @param   {String} toMobileNumber - Recipient's phone number
 * @param   {String} messageText - The alert message content
 */
const sendWhatsApp = async (toMobileNumber, messageText) => {
  try {
    // Production mein yahan Twilio client.messages.create() ka use hota hai
    console.log(`💬 [WhatsApp Alert Sent] to ${toMobileNumber} -> "${messageText}"`);
    return { success: true };
  } catch (error) {
    console.error("⚠️ WhatsApp sending failed:", error);
    return { success: false };
  }
};

module.exports = sendWhatsApp;