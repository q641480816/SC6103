const readline = require('readline');
const dgram = require('dgram');
const cluster = require('cluster');
const UTILS = require('./utils');
const properties = require('./properties.json');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let flightId, userId;

let flightList;

const useClient = (method, params) => {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        const req = UTILS.marshalMessage({ method: method, params: params });

        client.send(req, properties.basePort, 'localhost', (err) => {
            if (err) {
                reject(err);
                client.close();
            } else {
                client.once('message', (msg) => {
                    const response = UTILS.unmarshalMessage(msg);
                    if (response.error) reject(response.error);
                    if (response.res) resolve(response.res)
                    client.close();
                });
            }
        });
    })
}

const runQueryFlight = () => {
    return new Promise((resolve, reject) => {
        rl.question('Enter the from, to: ', (answer) => {
            let [from, to] = answer.split(',').map(v => v.trim());
            console.log(`From: ${from}`);
            console.log(`To: ${to}`);

            useClient(properties.METHOD_KEY.QUERY_FLIGHT, [from, to])
                .then(res => {
                    flightList = res;
                    resolve(res);
                })
                .catch(err => reject(err));
        })
    })
}

const runGetFlight = () => {
    return new Promise((resolve, reject) => {
        rl.question('Enter the Flight ID: ', (answer) => {
            flightId = answer.trim();
            console.log(`Flight ID: ${flightId}`);

            useClient(properties.METHOD_KEY.GET_FLIGHT, [flightId])
                .then(res => resolve(res))
                .catch(err => reject(err));
        })
    })
}

const runBookSeat = () => {
    return new Promise((resolve, reject) => {
        rl.question('Enter the Seat Number: ', (answer) => {
            const seatNum = parseInt(answer.trim());
            console.log(`Seat Number: ${seatNum}`);

            useClient(properties.METHOD_KEY.BOOK_SEAT, [userId, flightId, seatNum])
                .then(res => resolve(res))
                .catch(err => reject(err));
        })
    })
}

const creatClient = (port) => {
    const timeout = 20000;
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');

        client.bind({ port: port, exclusive: true }, () => {
            console.log(`Client bound to port ${port}`);
            resolve(client);
        });

        const req = UTILS.marshalMessage({
            method: properties.METHOD_KEY.REGISTER_FOR_SEAT_UPDATE,
            params: ['localhost', port, timeout, flightId]
        });
        client.send(req, properties.basePort, 'localhost', (err) => {
            if (err) {
                console.error('Error sending request:', err);
                client.close();
                reject('Failed to create client');
            } else {
                client.once('message', (msg) => {
                    const response = UTILS.unmarshalMessage(msg);
                    if (response.error) console.log(`Error: ${response.error}`)
                    if (response.res) console.log(`Res: Server has registered client at ${port} `)
                    // client.close();
                });
            }
        });

        client.on('message', (msg, rinfo) => {
            const message = UTILS.unmarshalMessage(msg);
            console.log('Test')
            console.log(msg)
            if (message.method === properties.METHOD_KEY.FLIGHT_UPDATE) {
                const update = message.params;
                console.log(`Update received: Flight ${update.flightIdentifier}, Seats Available: ${update.seatsAvailable}`);
                client.close();
            }
        });

        client.on('error', (err) => {
            console.error(`UDP error: ${err}`);
            client.close();
            reject('Failed running client');
        });

        setTimeout(() => {
            try {
                client.close()
            } catch (err) { }
        }, timeout);
    })
}

const runRegisterAndTest = () => {
    return new Promise((resolve, reject) => {
        const timeout = 20000;

        //creating UDP client
        console.log(`Creating client for Monitor, listen to ${flightId}`)
        creatClient(properties.clientBase)
            .then((clients) => {
                console.log(`Sending Book seat in 5 Seconds: [${userId}, ${flightId}, 35]`);

                setTimeout(() => {
                    useClient(properties.METHOD_KEY.BOOK_SEAT, [userId, flightId, 35])
                        .then(res => {
                            console.log(`Server res: ${res}`);
                            console.log('Test complete: Terminating in 2 sec...');

                            setTimeout(() => resolve(), 2000);
                        })
                        .catch(err => reject(err));
                }, 5000)
            })
            .catch(err => reject(err));
    })
}


const runApplyBoardMeFirst = () => {
    return new Promise((resolve, reject) => {
        // 只显示 User 和 FlightId，不再记录 seatNum
        console.log(`Requesting Board Me First for User ${userId} on Flight ${flightId}`);

        useClient(properties.METHOD_KEY.APPLY_BOARD_ME_FIRST, [userId, flightId])
            .then(res => resolve(res))
            .catch(err => reject(err));
    });
};





const runPreFlightOrder = () => {
    return new Promise((resolve, reject) => {
        rl.question('Enter the item to order: ', (answer) => {
            const item = answer.trim();
            console.log(`Ordering ${item} for User ${userId} on Flight ${flightId}`);

            useClient(properties.METHOD_KEY.PRE_FLIGHT_ORDER, [userId, flightId, item])
                .then(res => resolve(res))
                .catch(err => reject(err));
        });
    });
};


const methods = [runQueryFlight, runGetFlight, runBookSeat, runRegisterAndTest, runApplyBoardMeFirst, runPreFlightOrder];



const initPrompt = () => {
    rl.question(`
Enter User Id for usage, Comma seprated:
Enter your option: `, (answer) => {
        userId = answer.trim();
        console.log(`User ID: ${userId}`);
        mainPrompt();
    })
}

const mainPrompt = () => {
    rl.question(`
Choose a request (1-6):
1. Query flight by source and destination
2. Query flight details by flight ID
3. Reserve seats on a flight
4. Monitor seat availability
5. Apply for Board Me First (Idempotent)
6. Pre-Flight Order (Non-Idempotent)
Enter your option: `, (answer) => {
        const option = parseInt(answer) - 1;

        if (isNaN(option)) {
            console.log('Invalid Option!');
            mainPrompt();
        } else {
            methods[option]()
                .then(res => console.log(res))
                .catch(err => console.log(err))
                .finally(() => mainPrompt());
        }
    });
}


initPrompt();