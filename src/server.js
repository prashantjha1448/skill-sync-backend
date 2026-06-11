require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { Server } = require('socket.io');
const socketHandler = require('./Sockets/socketHandler');
const chatSocketHandler = require('./Sockets/chatSocket');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

// 1. Database Connect
connectDB();

// 2. HTTP Server Create kiya (Express app ko wrap karke)
const server = http.createServer(app);

// 3. Socket.io Engine Initialize kiya
const io = new Server(server, {
  cors: {
    origin: "*", // Jab frontend banega tab yahan frontend ka URL daalenge (e.g. http://localhost:5173)
    methods: ["GET", "POST"]
  }
});

// Socket Authentication Middleware
io.use(async (socket, next) => {
  try {
    let token = socket.handshake.auth?.token || socket.handshake.headers?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    socket.user = user;
    socket.userId = user._id.toString();
    next();
  } catch (err) {
    console.error('Socket Auth Error:', err.message);
    next(new Error('Authentication error: ' + err.message));
  }
});

// 4. Socket Handler ko call kiya
socketHandler(io);
chatSocketHandler(io);

// Express app ko io instance de diya taaki controllers (jaise TaskController) live alerts bhej sakein
app.set('io', io); 

// 5. Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Master Server & Socket Engine running on port ${PORT}`);
});