const UTILS = {
    marshalMessage: (data) => Buffer.from(JSON.stringify(data)),
    unmarshalMessage: (msg) => JSON.parse(msg.toString())
}

module.exports = UTILS;