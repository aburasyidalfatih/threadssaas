const { Pool } = require('pg');
const Redis = require('ioredis');

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// Database helper class
class Database {
  // Execute query with parameters
  static async query(text, params = []) {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // Get single row
  static async get(text, params = []) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  }

  // Get all rows
  static async all(text, params = []) {
    const result = await this.query(text, params);
    return result.rows;
  }

  // Execute with transaction
  static async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Prepared statement helper
  static prepare(sql) {
    return {
      get: async (params = []) => {
        const result = await Database.query(sql, params);
        return result.rows[0] || null;
      },
      all: async (params = []) => {
        const result = await Database.query(sql, params);
        return result.rows;
      },
      run: async (params = []) => {
        const result = await Database.query(sql, params);
        return {
          lastInsertRowid: result.rows[0]?.id || null,
          changes: result.rowCount
        };
      }
    };
  }
}

// Cache helper class
class Cache {
  // Set cache with TTL (seconds)
  static async set(key, value, ttl = 3600) {
    const serialized = JSON.stringify(value);
    if (ttl) {
      return await redis.setex(key, ttl, serialized);
    }
    return await redis.set(key, serialized);
  }

  // Get from cache
  static async get(key) {
    const value = await redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Delete from cache
  static async del(key) {
    return await redis.del(key);
  }

  // Check if key exists
  static async exists(key) {
    return await redis.exists(key);
  }

  // Set with pattern for bulk operations
  static async setPattern(pattern, data, ttl = 3600) {
    const pipeline = redis.pipeline();
    Object.entries(data).forEach(([key, value]) => {
      const fullKey = pattern.replace('*', key);
      pipeline.setex(fullKey, ttl, JSON.stringify(value));
    });
    return await pipeline.exec();
  }

  // Get all keys matching pattern
  static async getPattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return {};
    
    const values = await redis.mget(keys);
    const result = {};
    keys.forEach((key, index) => {
      const shortKey = key.replace(pattern.replace('*', ''), '');
      try {
        result[shortKey] = JSON.parse(values[index]);
      } catch {
        result[shortKey] = values[index];
      }
    });
    return result;
  }

  // Increment counter
  static async incr(key, amount = 1) {
    return await redis.incrby(key, amount);
  }

  // Set expiration
  static async expire(key, seconds) {
    return await redis.expire(key, seconds);
  }
}

// Session store for Redis
const { EventEmitter } = require('events');

class RedisSessionStore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.prefix = options.prefix || 'sess:';
    this.ttl = options.ttl || 86400; // 24 hours
  }

  async get(sid, callback) {
    try {
      const key = this.prefix + sid;
      const data = await redis.get(key);
      if (!data) return callback(null, null);
      const session = JSON.parse(data);
      callback(null, session);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, session, callback) {
    try {
      const key = this.prefix + sid;
      const data = JSON.stringify(session);
      await redis.setex(key, this.ttl, data);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback) {
    try {
      const key = this.prefix + sid;
      await redis.del(key);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid, session, callback) {
    try {
      const key = this.prefix + sid;
      await redis.expire(key, this.ttl);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  // Required by express-session
  createSession(req, sess) {
    const Session = require('express-session').Session;
    return new Session(req, sess);
  }
}

// Test connections
async function testConnections() {
  try {
    // Test PostgreSQL
    const pgResult = await Database.query('SELECT NOW() as current_time');
    console.log('✅ PostgreSQL connected:', pgResult.rows[0].current_time);

    // Test Redis
    await redis.set('test', 'connection');
    const redisResult = await redis.get('test');
    await redis.del('test');
    console.log('✅ Redis connected:', redisResult === 'connection');

    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await pool.end();
  redis.disconnect();
  process.exit(0);
});

module.exports = {
  Database,
  Cache,
  RedisSessionStore,
  testConnections,
  pool,
  redis
};
