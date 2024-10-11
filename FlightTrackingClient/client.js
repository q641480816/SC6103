const dgram = require('dgram');
const cluster = require('cluster');
// const client = dgram.createSocket('udp4');
const UTILS = require('./utils');
const properties = require('./properties.json');

const testQueryFlight = () => {
    const req = UTILS.marshalMessage({ method: properties.METHOD_KEY.QUERY_FLIGHT, params: ['Hangzhou', "Singapore"] });
    client.send(req, properties.basePort, 'localhost', (err) => {
        if (err) {
            console.error('Error sending request:', err);
            client.close();
        } else {
            client.once('message', (msg) => {
                const response = UTILS.unmarshalMessage(msg);
                if (response.error) console.log(`Error: ${response.error}`)
                if (response.res) console.log(`Res: ${response.res[0]}`)
                client.close();
            });
        }
    });
}

const testGetFlightInfo = () => {
    const req = UTILS.marshalMessage({ method: properties.METHOD_KEY.GET_FLIGHT, params: ['SD305'] });
    client.send(req, properties.basePort, 'localhost', (err) => {
        if (err) {
            console.error('Error sending request:', err);
            client.close();
        } else {
            client.once('message', (msg) => {
                const response = UTILS.unmarshalMessage(msg);
                if (response.error) console.log(`Error: ${response.error}`)
                if (response.res) console.log(`Res: ${JSON.stringify(response.res)}`)
                client.close();
            });
        }
    });
}

const testBookSeat = async () => {
    const client = dgram.createSocket('udp4');
    console.log('Book Seat triggered');
    const req = UTILS.marshalMessage({
        method: properties.METHOD_KEY.BOOK_SEAT,
        params: ['testUser4', 'TR422', '80']
    });
    client.send(req, properties.basePort, 'localhost', (err) => {
        if (err) {
            console.error('Error sending request:', err);
            client.close();
        } else {
            client.once('message', (msg) => {
                const response = UTILS.unmarshalMessage(msg);
                if (response.error) console.log(`Error: ${response.error}`)
                if (response.res) console.log(`Res: ${response.res}`)
                client.close();
            });
        }
    });
}

const testRegister = (client) => {
    const req = UTILS.marshalMessage({
        method: properties.METHOD_KEY.REGISTER_FOR_SEAT_UPDATE,
        params: ['localhost', properties.clientBase, 20000, 'TR422']
    });
    client.send(req, properties.basePort, 'localhost', (err) => {
        if (err) {
            console.error('Error sending request:', err);
            client.close();
        } else {
            client.once('message', (msg) => {
                const response = UTILS.unmarshalMessage(msg);
                if (response.error) console.log(`Error: ${response.error}`)
                if (response.res) console.log(`Res: ${response.res}`)
                // client.close();
            });
        }
    });
}

const testBoardMeFirst = () => {
    const userId = 'testUser';
    const flightId = 'SQ629';
    const client = dgram.createSocket('udp4');
    console.log('Apply board me first triggered');
    const req = UTILS.marshalMessage({
        method: properties.METHOD_KEY.BOOK_SEAT,
        params: [userId, flightId, '80']
    });
    client.send(req, properties.basePort, 'localhost', (err) => {
        if (err) {
            console.error('Error sending request:', err);
            client.close();
        } else {
            client.once('message', (msg) => {
                const response = UTILS.unmarshalMessage(msg);
                if (response.error) console.log(`Error: ${response.error}`)
                if (response.res) {
                    console.log(`Res: ${response.res}`)
                    const req2 = UTILS.marshalMessage({
                        method: properties.METHOD_KEY.APPLY_BOARD_ME_FIRST,
                        params: ["rownnj", flightId]
                    });

                    client.send(req2, properties.basePort, 'localhost', (err) => {
                        if (err) {
                            console.error('Error sending request:', err);
                            client.close();
                        } else {
                            client.once('message', (msg) => {
                                const response = UTILS.unmarshalMessage(msg);
                                if (response.error) console.log(`Error: ${response.error}`)
                                if (response.res) {
                                    console.log(`Res: ${response.res}`)
                                }
                                client.close();
                            });
                        }
                    });
                }
            });
        }
    });
}

const testPreFligthOrder = () => {
    const userId = 'testUser';
    const flightId = 'TK692';
    const client = dgram.createSocket('udp4');
    console.log('Apply board me first triggered');
    const req = UTILS.marshalMessage({
        method: properties.METHOD_KEY.BOOK_SEAT,
        params: [userId, flightId, '80']
    });
    client.send(req, properties.basePort, 'localhost', (err) => {
        if (err) {
            console.error('Error sending request:', err);
            client.close();
        } else {
            client.once('message', (msg) => {
                const response = UTILS.unmarshalMessage(msg);
                if (response.error) console.log(`Error: ${response.error}`)
                if (response.res) {
                    console.log(`Res: ${response.res}`)
                    const req2 = UTILS.marshalMessage({
                        method: properties.METHOD_KEY.PRE_FLIGHT_ORDER,
                        params: [userId, flightId, properties.CHICKEN_RICE]
                    });

                    client.send(req2, properties.basePort, 'localhost', (err) => {
                        if (err) {
                            console.error('Error sending request:', err);
                            client.close();
                        } else {
                            client.once('message', (msg) => {
                                const response = UTILS.unmarshalMessage(msg);
                                if (response.error) console.log(`Error: ${response.error}`)
                                if (response.res) {
                                    console.log(`Res: ${response.res}`)
                                }
                                client.close();
                            });
                        }
                    });
                }
            });
        }
    });
}

// if (cluster.isMaster) {

//     const worker = cluster.fork();
//     setTimeout(testBookSeat, 5000);
// } else {
//     const client = dgram.createSocket('udp4');

//     client.bind({ port: properties.clientBase, exclusive: true }, () => {
//         console.log(`Client bound to port ${properties.clientBase}`);

//         // Register for flight monitoring once the client is bound
//         // registerForFlightMonitoring();
//         testRegister(client);
//     });

//     client.on('message', (msg, rinfo) => {
//         const message = UTILS.unmarshalMessage(msg);
//         console.log(message);
//         // console.log(`Update received: Flight ${update.flightIdentifier}, Seats Available: ${update.seatsAvailable}`);
//     });

//     client.on('error', (err) => {
//         console.error(`UDP error: ${err}`);
//         client.close();
//     });

// }

// testBookSeat();

testPreFligthOrder()