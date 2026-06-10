require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../src/models/Job');

const mockJobs = [
  {
    title: 'React Native Developer Needed for iOS/Android App',
    description: 'We are looking for an experienced React Native developer to build a modern, responsive freelance marketplace mobile application. Must have experience with push notifications, maps, and state management.',
    category: 'development',
    skillsRequired: ['React Native', 'JavaScript', 'Redux', 'Mobile App Development'],
    budgetRange: { min: 25000, max: 75000 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'MP Nagar, Bhopal' },
    status: 'open'
  },
  {
    title: 'Modern UI/UX Designer for Web & Mobile App Design',
    description: 'Looking for a premium graphic designer to create Figma wireframes and high-fidelity prototypes for our new platform. Beautiful typography, glassmorphism, and dark modes are a big plus.',
    category: 'design',
    skillsRequired: ['Figma', 'UI/UX Design', 'Wireframing', 'Typography'],
    budgetRange: { min: 10000, max: 30000 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'Arera Colony, Bhopal' },
    status: 'open'
  },
  {
    title: 'Professional Plumber for Emergency Bathroom Pipe Repair',
    description: 'Need an urgent plumber to fix a leaking pipe in our bathroom and replace two taps. Must have own tools and be available immediately.',
    category: 'plumbing',
    skillsRequired: ['Plumbing', 'Pipe Repair', 'Bathroom Fittings'],
    budgetRange: { min: 500, max: 1500 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'Indrapuri, Bhopal' },
    status: 'open'
  },
  {
    title: 'Creative Content Writer for Tech Blog & Articles',
    description: 'Seeking a content writer to write 5 SEO-optimized articles about artificial intelligence, blockchain, and web development. Articles must be 100% original and free of plagiarism.',
    category: 'writing',
    skillsRequired: ['Content Writing', 'SEO', 'Technical Writing', 'Copywriting'],
    budgetRange: { min: 3000, max: 8000 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'Kolar Road, Bhopal' },
    status: 'open'
  },
  {
    title: 'Node.js/Express Backend Developer for REST API Integration',
    description: 'Need a backend developer to build robust secure endpoints, integrate third-party payment gateways, and optimize MongoDB indexes. Must be familiar with JWT and role authorization.',
    category: 'development',
    skillsRequired: ['Node.js', 'Express', 'MongoDB', 'API Development', 'REST APIs'],
    budgetRange: { min: 15000, max: 45000 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'BHEL, Bhopal' },
    status: 'open'
  },
  {
    title: 'Experienced Electrician for Complete Home Wiring',
    description: 'Looking for a certified electrician to install modern LED lights, ceiling fans, and rewire the living room socket board. Safety precautions must be followed.',
    category: 'electrical',
    skillsRequired: ['Electrical Wiring', 'Home Repairs', 'LED Installation'],
    budgetRange: { min: 1500, max: 5000 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'Ayodhya Bypass, Bhopal' },
    status: 'open'
  },
  {
    title: 'SEO Specialist & Digital Marketer for E-commerce Traffic',
    description: 'Need an expert to perform on-page and off-page SEO, set up Google Analytics, and run targeted Facebook ad campaigns to grow our organic store traffic.',
    category: 'marketing',
    skillsRequired: ['SEO', 'Google Analytics', 'Digital Marketing', 'Facebook Ads'],
    budgetRange: { min: 8000, max: 20000 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'MP Nagar, Bhopal' },
    status: 'open'
  },
  {
    title: 'Custom Wooden Wardrobe Maker & Carpenter',
    description: 'Need an experienced carpenter to design and assemble a sliding wooden wardrobe in our master bedroom. Material will be provided, you need to bring tools and do the construction.',
    category: 'carpentry',
    skillsRequired: ['Carpentry', 'Furniture Assembly', 'Woodworking'],
    budgetRange: { min: 5000, max: 12000 },
    location: { type: 'Point', coordinates: [77.4126, 23.2599], address: 'Arera Hills, Bhopal' },
    status: 'open'
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding...');

    // Clear existing open test jobs to avoid clutter
    await Job.deleteMany({ status: 'open' });
    console.log('🧹 Cleared existing open jobs...');

    // Insert mock jobs
    await Job.insertMany(mockJobs);
    console.log('🎉 Seeded 8 high-quality mock jobs successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
