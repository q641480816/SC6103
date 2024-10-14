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

let uniqueCounter = 0;

const useClient = (method, params, mode = 0, test = false, timeout = 3000, maxRetries = 3) => {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        uniqueCounter++;
        const req = UTILS.marshalMessage({ method: method, params: params, id: `${userId}${method}${uniqueCounter}`, mode: mode, test: test });
        let retries = 0;
        let responseTimeout;

        /*
            when test === false: req
            when test === true
            if !test: do not simulate packet lost
            else: Simulate the packet lost in first few tries and do not simulate at the last retry 
        */
        const sendRequest = () => {
            const request = !test || (test && retries <= maxRetries - 1) ? req :
                UTILS.marshalMessage({ method: method, params: params, id: `${userId}${method}${uniqueCounter}`, mode: mode, test: false });
            client.send(request, properties.basePort, 'localhost', (err) => {
                if (err) {
                    reject(err);
                    client.close();
                } else {
                    responseTimeout = setTimeout(() => {
                        if (retries < maxRetries) {
                            console.log(`Retrying... Attempt ${retries + 1} of ${maxRetries}`);
                            retries++;
                            sendRequest();
                        } else {
                            reject(new Error('No response from server, max retries reached.'));
                            client.close();
                        }
                    }, timeout);

                    if (retries === 0) {
                        client.once('message', (msg) => {
                            if (responseTimeout) {
                                clearTimeout(responseTimeout);
                            }
                            const response = UTILS.unmarshalMessage(msg);
                            if (response.error) reject(response.error);
                            else resolve(response.res);
                            try {
                                client.close();
                            } catch (err) { }
                        });
                    }
                }
            });
        };

        sendRequest();
    });
};

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

const runRegisterAndTest = () => {
    return new Promise((resolve, reject) => {
        useClient("REGISTOR", [flightId], properties.clientBase)
            .then(res => {
                console.log(res)
                return useClient("REGISTOR", [flightId], properties.clientBase + 1);
            })
            .then(res => {
                console.log(res);
                return useClient("REGISTOR", [flightList[1]], properties.clientBase + 2);
            }).then(res => {
                console.log(res)
                resolve(res);
            })
            .catch(err => {
                reject(err)
                console.log(err)
            });
    })
}


const runApplyBoardMeFirst = (mode = 0, test = false) => {
    return new Promise((resolve, reject) => {
        // 只显示 User 和 FlightId，不再记录 seatNum
        console.log(`Requesting Board Me First for User ${userId} on Flight ${flightId}`);

        useClient(properties.METHOD_KEY.APPLY_BOARD_ME_FIRST, [userId, flightId], mode, test)
            .then(res => resolve(res))
            .catch(err => reject(err));
    });
};

const runPreFlightOrder = (mode = 0, test = false) => {
    return new Promise((resolve, reject) => {
        rl.question('Enter the item to order: ', (answer) => {
            const item = answer.trim();
            console.log(`Ordering ${item} for User ${userId} on Flight ${flightId}`);

            useClient(properties.METHOD_KEY.PRE_FLIGHT_ORDER, [userId, flightId, item], mode, test)
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
5. Apply for Board Me First (Idempotent, at most once)
6. Pre-Flight Order (Non-Idempotent, at most once)
7. Pre-Flight Order (Non-Idempotent, at most once, simulate packet lost)
8. Apply for Board Me First (Idempotent, at least once, simulate packet lost)
9. Pre-Flight Order (Non-Idempotent, at least once, simulate packet lost)
Enter your option: `, (answer) => {
        const option = parseInt(answer) - 1;

        if (isNaN(option)) {
            console.log('Invalid Option!');
            mainPrompt();
        } else {
            if (option < 6) {
                methods[option]()
                    .then(res => console.log(res))
                    .catch(err => console.log(err))
                    .finally(() => mainPrompt());
            } else {
                let method;
                switch (option) {
                    case 6:
                        method = methods[5](0, true)
                        break;
                    case 7:
                        method = methods[4](1, true)
                        break;
                    case 8:
                        method = methods[5](1, true)
                        break;
                }

                method
                    .then(res => console.log(res))
                    .catch(err => console.log(err))
                    .finally(() => mainPrompt());
            }
        }
    });
}


initPrompt();