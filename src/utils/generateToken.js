const jwt = require('jsonwebtoken');

const generateToken = (res, userId) => {
  // Token banate hain jo 30 din tak valid rahega
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  // Token ko HTTP-Only cookie mein set karte hain (Security ke liye)
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development', // Production mein sirf HTTPS par chalega
    sameSite: 'strict', // CSRF attacks rokne ke liye
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days in milliseconds
  });
};

module.exports = generateToken;
