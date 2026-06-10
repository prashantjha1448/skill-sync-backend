const Job  = require('../models/Job');
const User = require('../models/User');

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// GET /geo/nearby-jobs
exports.getNearbyJobs = async (req, res, next) => {
  try {
    const { lat, lng, radius = 25, category, keyword } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });

    const query = {
      status: 'open',
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(radius) * 1000,
        },
      },
    };
    if (category && category !== 'all' && category !== 'All') {
      query.category = { $regex: category, $options: 'i' };
    }
    if (keyword)  query.$or = [
      { title:       { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
    ];

    const jobs = await Job.find(query).limit(50);
    const withDist = jobs.map((j) => ({
      ...j.toObject(),
      distance: Math.round(haversine(Number(lat), Number(lng), j.location.coordinates[1], j.location.coordinates[0]) * 10) / 10,
    }));

    res.status(200).json({ success: true, count: withDist.length, jobs: withDist });
  } catch (error) { next(error); }
};

// GET /geo/nearby-freelancers
exports.getNearbyFreelancers = async (req, res, next) => {
  try {
    const { lat, lng, radius = 25, category, keyword } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });

    const query = {
      role: 'FREELANCER',
      isAvailable: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(radius) * 1000,
        },
      },
    };

    if (category && category !== 'all' && category !== 'All') {
      query.skills = { $in: [new RegExp(category, 'i')] };
    }

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { username: { $regex: keyword, $options: 'i' } },
        { title: { $regex: keyword, $options: 'i' } },
        { bio: { $regex: keyword, $options: 'i' } },
      ];
    }

    const freelancers = await User.find(query).select('-password').limit(50);
    const withDist = freelancers.map((f) => ({
      ...f.toObject(),
      distance: Math.round(haversine(Number(lat), Number(lng), f.location.coordinates[1], f.location.coordinates[0]) * 10) / 10,
    }));

    res.status(200).json({
      success: true,
      count: withDist.length,
      freelancers: withDist,
      data: withDist,
    });
  } catch (error) { next(error); }
};

// PUT /geo/update-location
exports.updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ success: false, message: 'latitude and longitude required' });

    await User.findOneAndUpdate(
      { email: req.user.email },
      { location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] } },
      { upsert: true }
    );
    res.status(200).json({ success: true, message: 'Location updated' });
  } catch (error) { next(error); }
};

// PUT /geo/set-radius
exports.setRadius = async (req, res, next) => {
  try {
    const { radius } = req.body;
    if (!radius) return res.status(400).json({ success: false, message: 'radius required' });

    await User.findOneAndUpdate({ email: req.user.email }, { serviceRadius: Number(radius) }, { upsert: true });
    res.status(200).json({ success: true, message: `Radius set to ${radius} km` });
  } catch (error) { next(error); }
};