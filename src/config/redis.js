const redis = require('redis');

const redisUrl = process.env.REDIS_URL;
let redisClient;

if (redisUrl) {
  redisClient = redis.createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    console.log('Redis Client Error (cache disabled):', err.message);
  });

  redisClient.on('connect', () => {
    console.log('Redis connected successfully ⚡');
  });

  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      console.log('Redis unavailable — continuing without cache:', err.message);
    }
  })();
} else {
  // Provide a clean mock object if Redis is not configured
  redisClient = {
    isOpen: false,
    on: () => {},
    connect: async () => {},
    get: async () => null,
    setEx: async () => {},
    del: async () => {},
  };
  console.log('Redis URL not configured — caching disabled ⚡');
}

module.exports = redisClient;