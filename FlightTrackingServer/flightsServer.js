const cluster = require('cluster');
const dgram = require('dgram');
const logger = require('./logger')(module);
const properties = require('./properties.json');
const UTILS = require('./utils');
const { acquireClient, hSet, hGet, flushdb, hExists } = require('./redisService');
const fligthService = require('./flightService');

const test = () => {
    return { res: 'OK' };
}

const initFlight = async () => {
    try {
        await flushdb();
        logger.info("Redis flushed!");
        const flights = UTILS.generateFlights(20);
        // console.log(flights);
        const promises = [];
        const fromToMap = {};
        flights.forEach(f => {
            const fromTo = `${f.from}${f.destination}`;
            if (!(fromTo in fromToMap)) fromToMap[fromTo] = [];
            fromToMap[fromTo].push(f.flightIdentifier);
            promises.push(hSet(f.flightIdentifier, properties.REDIS_KEY.FLIGHT_INFO, JSON.stringify(f)));
            promises.push(hSet(f.flightIdentifier, properties.REDIS_KEY.FLIGHT_BOOKING, JSON.stringify({})));
            promises.push(hSet(f.flightIdentifier, properties.REDIS_KEY.REGISTERED_LISTENER, JSON.stringify([])));
            promises.push(hSet(f.flightIdentifier, properties.REDIS_KEY.BOARD_ME_FIRST, JSON.stringify({})))
            promises.push(hSet(f.flightIdentifier, properties.REDIS_KEY.PRE_FLIGHT_ORDER, JSON.stringify({})))
        })
        Object.keys(fromToMap)
            .forEach(ft => promises.push(hSet(properties.REDIS_KEY.FROM_TO_MAP, ft, JSON.stringify(fromToMap[ft]))));
        const batchRes = await Promise.all(promises);

        const c = await acquireClient();
        const res = await c.HGETALL(properties.REDIS_KEY.FROM_TO_MAP, Object.keys(fromToMap)[0]);
        console.log(res);
        logger.info("Flights info all intialized!");
    } catch (err) {
        console.log(err);
        logger.error("Error in intializing Flights info");
    }
}

const processRequest = async (request, callback, server) => {
    let res;
    try {
        if (!request.method || !(request.method in fligthService))
            throw Error('Invalid method!');

        //at most once
        if (request.mode === 0 && await hExists(properties.REDIS_KEY.REQUEST_MAP, request.id)) {
            res = { status: 200, res: 'Duplicated request' }
        } else {
            res = { status: 200, res: await fligthService[request.method](...request.params, server) };

            await hSet(properties.REDIS_KEY.REQUEST_MAP, request.id, '1');
        }

    } catch (err) {
        logger.info(`Error occur in proccesing request: ${err.message}`);
        res = { statue: 503, error: err.message };
    } finally {
        console.log(res);
        if (request.test) {
            logger.debug('Simulating packet lost: Skipping rending response...');
        } else callback(res);
    }
}

if (cluster.isMaster) {
    const socketServerMap = {};
    initFlight();

    for (let i = 0; i < 4; i++) {
        const port = properties.basePort + i;
        const worker = cluster.fork({ port: port });
        logger.debug(`Worker started at ${worker.process.pid}, assiging port ${port}`)
        socketServerMap[worker.process.pid] = port;
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.debug(`Worker ${worker.process.pid} died, reviving new worker...`);
        const port = socketServerMap[worker.process.pid];
        const newWorker = cluster.fork({ port: port });
        logger.debug(`Worker started at ${newWorker.process.pid}, assiging port ${port}`)
        delete socketServerMap[worker.process.pid];
    });
} else {
    const server = dgram.createSocket('udp4');
    const port = process.env.port;

    server.on('message', (msg, rinfo) => {
        logger.info(`Received request from ${rinfo.address}:${rinfo.port} at instance ${port}`);
        let request = UTILS.unmarshalMessage(msg);
        if(request.method === 'ping'){
            UTILS.sendResponse(server, UTILS.marshalMessage({res: 'pong'}), rinfo);
        }else{
            logger.info(`Requesting method: ${request.method}`)
            logger.info(`Payload: ${JSON.stringify(request.params)}`)
            processRequest(request, (response) => {
                UTILS.sendResponse(server, UTILS.marshalMessage(response), rinfo);
            }, server)
        }
    });

    server.on('error', (err) => {
        logger.error(`Server error on port ${port}:`, err);
        server.close();
    });

    server.bind({ port: port, exclusive: true }, () => {
        // server.addMembership('localhost');
        logger.info(`Server is listening on port ${port}`);
    });
}

