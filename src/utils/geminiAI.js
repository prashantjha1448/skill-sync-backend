const { GoogleGenerativeAI } = require('@google/generative-ai');

// AI Initialize kiya key ke sath
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * @desc    Parses raw job description and extracts matching skill keywords using Gemini
 * @param   {String} description 
 * @returns {Array} Array of strings (skills)
 */
exports.extractSkillsFromText = async (description) => {
  try {
    // We use gemini-1.5-flash as it is extremely fast and perfect for text structuring
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" } // Ensure strict JSON output
    });
    
    const prompt = `Analyze the following job description or user requirement for a local service marketplace. 
    Extract a list of relevant professional skills, tools, or service categories needed to complete this work.
    
    Return the output STRICTLY as a JSON array of strings in lowercase. Do not include any explanation or extra text.
    
    Example Input: "Mera geyser kharab ho gya h paani garam nhi kr rha urgent koi aao fixed krne"
    Example Output: ["plumber", "geyser repair", "appliance repair", "electrician"]
    
    Current Job Description: "${description}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // JSON string ko JavaScript array mein convert kiya
    return JSON.parse(responseText);
  } catch (error) {
    console.error("🤖 AI Parsing Error, falling back to basic regex array:", error);
    // Safer side fallback agar API hit limit par ho to description ko split kar dega
    return description.toLowerCase().split(' ').filter(word => word.length > 3);
  }
};