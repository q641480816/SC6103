const redis = require('redis');
const logger = require('./logger')(module);
const { createPool } = require('generic-pool');
const properties = require('./properties.json');

const redisConfig = properties.redisConfig;

const redisPool = createPool({
    create: () => {
        return new Promise((resolve, reject) => {
            const client = redis.createClient({
                host: redisConfig.host,
                port: redisConfig.port,
            });

            client.on('error', (err) => {
                logger.error('Redis connection error:', err);
                reject(err);
            });

            client.on('connect', () => {
                logger.debug('Redis connection established');
                resolve(client);
            });

            client.connect();
        });
    },
    destroy: (client) => {
        return new Promise((resolve) => {
            client.quit(() => {
                logger.debug('Redis connection closed');
                resolve();
            });
        });
    }
}, {
    max: redisConfig.maxClients,
    min: redisConfig.minClients,
    idleTimeoutMillis: redisConfig.idleTimeoutMillis,
    acquireTimeoutMillis: redisConfig.acquireTimeoutMillis,
    evictionRunIntervalMillis: 30000,
    softIdleTimeoutMillis: 30000
});

const acquireClient = async () => {
    try {
        const client = await redisPool.acquire();
        return client;
    } catch (err) {
        logger.error('Error acquiring Redis client:', err);
        throw err;
    }
}

const releaseClient = async (client) => {
    try {
        await redisPool.release(client);
    } catch (err) {
        logger.error('Error releasing Redis client:', err);
    }
}

const useRedisClient = async (func) => {
    let client;
    try {
        client = await acquireClient();
        const result = await func(client);
        return result;
    } catch (err) {
        logger.error('Error using Redis client:', err);
        throw err;
    } finally {
        if (client) {
            await releaseClient(client);
        }
    }
}

const useRedisClientMethod = async (m, ...params) => {
    let client;
    try {
        client = await acquireClient();
        const result = await client[m](...params);
        return result;
    } catch (err) {
        logger.error('Error using Redis client:', err);
        throw err;
    } finally {
        if (client) {
            await releaseClient(client);
        }
    }
}

const hSet = (key, f, v) => useRedisClientMethod('HSET', key, f, v);
const hGet = (key, f) => useRedisClientMethod('HGET', key, f);
const hGetAll = (key) => useRedisClientMethod('HGETALL', key);
const hExists = (key, f) => useRedisClientMethod('HEXISTS', key, f);
const exists = (key) => useRedisClientMethod('EXISTS', key);
const flushdb = () => useRedisClientMethod('FLUSHDB');

module.exports = { acquireClient, releaseClient, useRedisClient, useRedisClientMethod, hSet, hGet, hExists, exists, flushdb, hGetAll};