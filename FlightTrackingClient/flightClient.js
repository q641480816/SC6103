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

const useClient = (method, params, port) => {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        const req = UTILS.marshalMessage({ method: method, params: params });

        client.send(req, port || properties.basePort, 'localhost', (err) => {
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
                console.log(err)});
    })
}

const methods = [runQueryFlight, runGetFlight, runBookSeat, runRegisterAndTest];


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
5. (Your idempotent operation)
6. (Your non-idempotent operation)
Enter your option: `, (answer) => {
        const option = parseInt(answer) - 1;

        if (isNaN(option)) {
            console.log('Invalid Option!');
            mainPrompt()
        } else {
            methods[option]()
                .then(res => console.log(res))
                .catch(err => console.log(err))
                .finally(a => mainPrompt())
        }
    })
}

initPrompt();