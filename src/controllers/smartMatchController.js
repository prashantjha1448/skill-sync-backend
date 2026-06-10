const User = require('../models/User');
const { extractSkillsFromText } = require('../utils/geminiAI');

// @desc    Smart Match Freelancers based on Natural Language Description & Location
// @route   POST /api/v1/jobs/smart-match
// @access  Private (Client Only)
exports.smartMatchFreelancers = async (req, res, next) => {
  try {
    const { description, coordinates } = req.body; 

    // Validation
    if (!description) {
      return res.status(400).json({ success: false, message: 'Please provide a job description text' });
    }
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ success: false, message: 'Please provide valid location coordinates [longitude, latitude]' });
    }

    // 1. Send text to Gemini to extract skill tags
    const aiSkills = await extractSkillsFromText(description);
    console.log("🤖 Gemini Extracted Skills Tags:", aiSkills);

    // 2. MongoDB Geo-spatial & Keyword Match Query
    const matchedFreelancers = await User.find({
      role: 'freelancer',
      isAvailable: true,
      skills: { $in: aiSkills }, // Match if freelancer has ANY of the AI extracted skills
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: coordinates // [longitude, latitude] of the client
          },
          $maxDistance: 15000 // 15,000 meters = 15 Kilometers radius max
        }
      }
    }).select('-password').limit(10); // Password hide kiya aur top 10 paas wale log nikal liye

    res.status(200).json({
      success: true,
      aiKeywordsMatched: aiSkills,
      count: matchedFreelancers.length,
      data: matchedFreelancers
    });

  } catch (error) {
    next(error);
  }
};