const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const errorHandler = require('./middlewares/errorHandler');
const authRoutes        = require('./routes/authRoutes');
const profileRoutes     = require('./routes/profileRoutes');
const geoRoutes         = require('./routes/geoRoutes');
const messageRoutes     = require('./routes/messageRoutes');
const jobRoutes         = require('./routes/jobRoutes');
const proposalRoutes    = require('./routes/proposalRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const kycRoutes         = require('./routes/kycRoutes');
const taskRoutes        = require('./routes/taskRoutes');
const notificationRoutes= require('./routes/notificationRoutes');
const reviewRoutes      = require('./routes/reviewRoutes');
const smartMatchRoutes  = require('./routes/smartMatchRoutes');
const walletRoutes      = require('./routes/walletRoutes');
const paymentRoutes     = require('./routes/paymentRoutes');
const analyticsRoutes   = require('./routes/analyticsroutes');
const dashboardRoutes   = require('./routes/dashboardRoutes');

// Admin module routes
const adminAuthRoutes      = require('./modules/admin/routes/adminAuthRoutes');
const adminUserRoutes      = require('./modules/admin/routes/adminUserRoutes');
const adminTaskRoutes      = require('./modules/admin/routes/adminTaskRoutes');
const adminPaymentRoutes   = require('./modules/admin/routes/adminPaymentRoutes');
const adminAnalyticsRoutes = require('./modules/admin/routes/adminAnalyticsRoutes');
const adminAuditRoutes     = require('./modules/admin/routes/adminAuditRoutes');
const superAdminRoutes     = require('./modules/admin/routes/superAdminRoutes');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15*60*1000, max: 200, message: { success:false, message:'Too many requests' } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/api/v1/health', (_, res) => res.json({ status: 'active', message: 'SkillSync API running' }));

// ── Platform Routes ─────────────────────────────────
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/profile',       profileRoutes);
app.use('/api/v1/geo',           geoRoutes);
app.use('/api/v1/messages',      messageRoutes);
app.use('/api/v1/jobs',          jobRoutes);
app.use('/api/v1/jobs',          smartMatchRoutes);
app.use('/api/v1/proposals',     proposalRoutes);
app.use('/api/v1/transactions',  transactionRoutes);
app.use('/api/v1/kyc',           kycRoutes);
app.use('/api/v1/tasks',         taskRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reviews',       reviewRoutes);
app.use('/api/v1/wallet',        walletRoutes);
app.use('/api/v1/payments',      paymentRoutes);
app.use('/api/v1/analytics',     analyticsRoutes);
app.use('/api/v1/dashboard',     dashboardRoutes);

// ── Admin Module Routes (separate auth, stricter rate limit) ──
const adminLimiter = rateLimit({ windowMs: 15*60*1000, max: 60, message: { success:false, message:'Admin rate limit exceeded' } });
app.use('/api/admin/auth',       adminLimiter, adminAuthRoutes);
app.use('/api/admin/users',      adminLimiter, adminUserRoutes);
app.use('/api/admin/tasks',      adminLimiter, adminTaskRoutes);
app.use('/api/admin/payments',   adminLimiter, adminPaymentRoutes);
app.use('/api/admin/analytics',  adminLimiter, adminAnalyticsRoutes);
app.use('/api/admin/audit',      adminLimiter, adminAuditRoutes);
app.use('/api/admin/super',      adminLimiter, superAdminRoutes);

app.use(errorHandler);
module.exports = app;