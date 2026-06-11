const multer = require('multer');

// Memory storage to process files as buffers before uploading to Cloudinary
const storage = multer.memoryStorage();

const chatUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit size to 50MB to support audio and video
  fileFilter: (req, file, cb) => {
    // Allow all types of files (images, video, audio, PDFs, docs, zips)
    cb(null, true);
  }
});

module.exports = chatUpload;
