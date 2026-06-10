const express = require('express');
const router  = express.Router();
const { getNearbyJobs, getNearbyFreelancers, updateLocation, setRadius } = require('../controllers/geoController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/nearby-jobs',          getNearbyJobs);
router.get('/nearby-freelancers',   protect, getNearbyFreelancers);
router.put('/update-location',      protect, updateLocation);
router.put('/set-radius',           protect, setRadius);

module.exports = router;