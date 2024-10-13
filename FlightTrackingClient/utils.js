const UTILS = {
    marshalMessage: (data) => Buffer.from(JSON.stringify(data)),
    unmarshalMessage: (msg) => JSON.parse(msg.toString()),
    sendResponse: (server, msg, rinfo) => server.send(msg, rinfo.port, rinfo.address, (err) => {
        if (err) console.error('Error sending response:', err);
    })
}

module.exports = UTILS;