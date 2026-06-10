const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});

let redisReady = false;

redisClient.on('error', (err) => {
  redisReady = false;
  console.log('Redis Client Error (cache disabled):', err.message);
});

redisClient.on('connect', () => {
  redisReady = true;
  console.log('Redis connected successfully ⚡');
});

(async () => {
  try {
    await redisClient.connect();
    redisReady = true;
  } catch (err) {
    redisReady = false;
    console.log('Redis unavailable — continuing without cache:', err.message);
  }
})();

module.exports = redisClient;