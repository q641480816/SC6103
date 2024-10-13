const { hGet, hExists, hSet } = require('./redisService');
const properties = require('./properties.json');
const UTILS = require('./utils');
const logger = require('./logger')(module);

const QUERY_FLIGHT = async (from, to) => {
    try {
        if (!from || !to) throw Error('Invalied Source or Destination!');
        const fromTo = `${from}${to}`
        const exists = await hExists(properties.REDIS_KEY.FROM_TO_MAP, fromTo);
        if (!exists) throw Error('No filghts avaliable for given Source and Destination!');
        const flights = JSON.parse(await hGet(properties.REDIS_KEY.FROM_TO_MAP, `${from}${to}`));
        if (flights.lenght === 0) throw Error('No filghts avaliable for given Source and Destination!');
        console.log(typeof flights)
        return flights;
    } catch (err) {
        logger.error(err.message);
        throw err;
    }
}

const GET_FLIGHT = async (flightId) => {
    try {
        if (!flightId || flightId.length !== 5)
            throw Error('Invalid Flight Identifier provided!');

        const flight = JSON.parse(await hGet(flightId, properties.REDIS_KEY.FLIGHT_INFO));
        if (!flight)
            throw Error(`No matching flight found for ${flightId}!`)

        return flight;
    } catch (err) {
        logger.error(err.message);
        throw err;
    }
}

const BOOK_SEAT = async (userId, flightId, seatNum, server) => {
    try {
        if (!userId)
            throw Error('Missing User Id');

        //check Flight
        if (!flightId || flightId.length !== 5)
            throw Error('Invalid Flight Identifier provided!');
        const flightSeats = JSON.parse(await hGet(flightId, properties.REDIS_KEY.FLIGHT_BOOKING));
        if (!flightSeats)
            throw Error(`No matching flight found for ${flightId}!`)
        const flight = await GET_FLIGHT(flightId);

        if (!seatNum || isNaN(seatNum) || seatNum < 0 || seatNum > flight.capacity)
            throw Error('Invalid seat number!')

        if (userId in flightSeats && parseInt(seatNum) !== flightSeats[userId])
            throw Error(`User ${userId} has booked seat[${flightSeats[userId]}], cannot book again with given seat [${seatNum}]!`);

        const unaval = new Set(Object.values(flightSeats));
        if (!(userId in flightSeats) && unaval.has(parseInt(seatNum)))
            throw Error(`seat [${seatNum}] has been taken!`);

        flightSeats[userId] = parseInt(seatNum);

        await hSet(flightId, properties.REDIS_KEY.FLIGHT_BOOKING, JSON.stringify(flightSeats));
        NOTIFY_MONITORS(flightId, server);
        return { [flightId]: { [userId]: seatNum } };

    } catch (err) {
        throw err;
    }
}

const REGISTER_FOR_SEAT_UPDATE = async (ip, port, interval, flightId) => {
    try {
        if (!ip || !port || !UTILS.validIpPort(ip, port))
            throw Error('Invalid IP address or Port!');

        if (!interval || isNaN(interval) || parseInt(interval) < 10000)
            throw Error('Invalid interval is provided! Interval must be more than 10 seconds!');

        //check Flight
        if (!flightId || flightId.length !== 5)
            throw Error('Invalid Flight Identifier provided!');
        const flightMonitors = JSON.parse(await hGet(flightId, properties.REDIS_KEY.REGISTERED_LISTENER));
        if (!flightMonitors)
            throw Error(`No matching flight found for ${flightId}!`)

        flightMonitors.push({
            ip: ip,
            port: port,
            interval: interval,
            timestemp: Date.now()
        })

        await hSet(flightId, properties.REDIS_KEY.REGISTERED_LISTENER, JSON.stringify(flightMonitors));
        const test = await hGet(flightId, properties.REDIS_KEY.REGISTERED_LISTENER);
        console.log(test)
        return 'ok';
    } catch (err) {
        throw err;
    }
}

const NOTIFY_MONITORS = async (flightId, server) => {
    try {
        const now = Date.now()
        const flightMonitors = JSON.parse(await hGet(flightId, properties.REDIS_KEY.REGISTERED_LISTENER));
        const flightSeats = JSON.parse(await hGet(flightId, properties.REDIS_KEY.FLIGHT_BOOKING));
        const flight = JSON.parse(await hGet(flightId, properties.REDIS_KEY.FLIGHT_INFO));
        const res = { method: properties.CLIENT_METHOD_KEY.FLIGHT_UPDATE, params: [] };

        const fullSeat = Array.from({ length: parseInt(flight.capacity) }, (_, i) => i + 1);
        const unaval = new Set(Object.values(flightSeats));
        const avaliableSeat = fullSeat.filter(s => !unaval.has(s));
        res.params.push(flightId, avaliableSeat.length, avaliableSeat);
        console.log(flightMonitors);
        const newFlightMonitors = flightMonitors.filter(fm => now <= fm.interval + fm.timestemp);
        console.log(newFlightMonitors);
        await hSet(flightId, properties.REDIS_KEY.REGISTERED_LISTENER, JSON.stringify(flightMonitors));
        newFlightMonitors.forEach(fm => UTILS.sendResponse(server, UTILS.marshalMessage(res), { address: fm.ip, port: fm.port }));
        logger.info(`${flightId} seat update has been broadcasted!`);
    } catch (err) {
        logger.error(`Error in broadcasting sear update for ${flightId}`, err);
    }
}

//Idempotent Operation
const APPLY_BOARD_ME_FIRST = async (userId, flightId) => {
    try {
        if (!userId)
            throw Error('Missing User Id');

        //check Flight
        if (!flightId || flightId.length !== 5)
            throw Error('Invalid Flight Identifier provided!');
        const flightSeats = JSON.parse(await hGet(flightId, properties.REDIS_KEY.FLIGHT_BOOKING));
        if (!flightSeats)
            throw Error(`No matching flight found for ${flightId}!`);

        if (!(userId in flightSeats))
            throw Error('User has not book this flight yet, cannot apply Board me first');

        const boardMeFirst = JSON.parse(await hGet(flightId, properties.REDIS_KEY.BOARD_ME_FIRST));
        boardMeFirst[userId] = true;
        await hSet(flightId, properties.REDIS_KEY.BOARD_ME_FIRST, JSON.stringify(boardMeFirst));

        const res = JSON.stringify(await hGet(flightId, properties.REDIS_KEY.BOARD_ME_FIRST))[userId];

        return res;
    } catch (err) {
        throw err;
    }
}

//Non-Idemponent Operation
const PRE_FLIGHT_ORDER = async (userId, flightId, item) => {
    try {
        if (!userId)
            throw Error('Missing User Id');

        //check Flight
        if (!flightId || flightId.length !== 5)
            throw Error('Invalid Flight Identifier provided!');
        const flightSeats = JSON.parse(await hGet(flightId, properties.REDIS_KEY.FLIGHT_BOOKING));
        if (!flightSeats)
            throw Error(`No matching flight found for ${flightId}!`);

        if (!(userId in flightSeats))
            throw Error('User has not book this flight yet, cannot purchase pre-flight orer');

        const preFlightOrder = JSON.parse(await hGet(flightId, properties.REDIS_KEY.PRE_FLIGHT_ORDER));
        if (!preFlightOrder[userId])
            preFlightOrder[userId] = [];
        preFlightOrder[userId].push(item);
        await hSet(flightId, properties.REDIS_KEY.PRE_FLIGHT_ORDER, JSON.stringify(preFlightOrder));

        return preFlightOrder[userId];
    } catch (err) {
        throw err;
    }
}

module.exports = { QUERY_FLIGHT, GET_FLIGHT, BOOK_SEAT, REGISTER_FOR_SEAT_UPDATE, APPLY_BOARD_ME_FIRST, PRE_FLIGHT_ORDER };