const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. Protect Route: Checks if user is logged in
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');

    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'The user belonging to this token no longer exists.' });
    }

    req.user = currentUser;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

// Optional Protect Route: Populates req.user if logged in, but allows guest access
exports.optionalProtect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const currentUser = await User.findById(decoded.id);
    if (currentUser) {
      req.user = currentUser;
    }
    next();
  } catch (error) {
    // If token is invalid/expired, still allow access as guest
    next();
  }
};

// 2. Authorize Route: Checks if user has the right role (Client or Freelancer)
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Prisma mein role 'CLIENT' (uppercase) save hota hai, aur routes mein hum 'client' bhejte hain
    // Isliye dono ko lowercase karke match karte hain taaki case-sensitivity ka issue na aaye
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};