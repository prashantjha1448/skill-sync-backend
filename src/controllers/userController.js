const User = require('../models/User');

// @desc    Update user profile with strict rules (Email/Mobile 1-time edit)
// @route   PUT /api/v1/users/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { 
      name, email, mobileNumber, address, city, 
      coordinates, skills, newSkills, hourlyRate, 
      isAvailable, serviceRadius 
    } = req.body;

    // 1. NAME (Unlimited Edits)
    if (name) user.name = name;

    // 2. STRICT EMAIL RULE: (Only 1 time allowed)
    if (email && email !== user.email) {
      if (user.isEmailEdited) {
        return res.status(400).json({ success: false, message: 'Email can only be changed once.' });
      }
      user.email = email;
      user.isEmailEdited = true;
    }

    // 3. STRICT MOBILE RULE: (Only 1 time allowed)
    if (mobileNumber && mobileNumber !== user.mobileNumber) {
      if (user.isMobileEdited) {
        return res.status(400).json({ success: false, message: 'Mobile number can only be changed once.' });
      }
      user.mobileNumber = mobileNumber;
      user.isMobileEdited = true;
    }

    // 4. ADDRESS & LOCATION (Unlimited Edits)
    if (address) user.location.address = address;
    if (city) user.location.city = city;
    if (coordinates) {
      // coordinates array format me aana chahiye: [longitude, latitude]
      user.location.coordinates = coordinates; 
    }

    // 5. SKILLS UPDATE: Merge old and new skills, remove duplicates automatically
    if (skills || newSkills) {
      const incomingSkills = skills ? (Array.isArray(skills) ? skills : skills.split(',')) : [];
      const incomingNewSkills = newSkills ? (Array.isArray(newSkills) ? newSkills : newSkills.split(',')) : [];
      
      const allSkills = [...user.skills, ...incomingSkills, ...incomingNewSkills].map(s => s.trim().toLowerCase());
      
      // 'Set' ka use karke duplicates ko hata diya
      user.skills = [...new Set(allSkills)];
    }

    // 6. FREELANCER SPECIFIC DETAILS (Unlimited Edits)
    if (hourlyRate) user.hourlyRate = hourlyRate;
    if (isAvailable !== undefined) user.isAvailable = isAvailable;
    if (serviceRadius) user.serviceRadius = serviceRadius;

    // 7. AVATAR UPLOAD (Agar Cloudinary/Multer se image aayi hai)
    if (req.file && req.file.path) {
      user.avatar = req.file.path;
    }

    // Finally, save the user object (Ye save hook trigger karega, lekin password modify nahi hua to kuch nahi karega)
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      data: user
    });

  } catch (error) {
    next(error);
  }
};