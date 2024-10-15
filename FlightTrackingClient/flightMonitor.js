const dgram = require('dgram');
const cluster = require('cluster');
// const client = dgram.createSocket('udp4');
const UTILS = require('./utils');
const properties = require('./properties.json');
const os = require('os');
const networkInterfaces = os.networkInterfaces();
let ipAddress = null;

for (const interfaceName in networkInterfaces) {
  const interfaces = networkInterfaces[interfaceName];
  
  for (const iface of interfaces) {
    if (iface.family === 'IPv4' && !iface.internal) {
      ipAddress = iface.address;
      break;
    }
  }
  if (ipAddress) break;
}

if (cluster.isMaster) {
    const socketServerMap = {};

    for (let i = 0; i < 3; i++) {
        const port = properties.clientBase + i;
        const worker = cluster.fork({ port: port });
        console.log(`Worker started at ${worker.process.pid}, assiging port ${port}`)
        socketServerMap[worker.process.pid] = port;
    }
} else {
    const server = dgram.createSocket('udp4');
    const port = process.env.port;

    server.on('message', (msg, rinfo) => {
        console.log(`Received request from ${rinfo.address}:${rinfo.port} at instance ${port}`);
        let request = UTILS.unmarshalMessage(msg);

        if (request.method === "REGISTOR") {
            console.log(`Requesting method: ${request.method}`)
            console.log(`Payload: ${JSON.stringify(request.params)}`)
            const req = UTILS.marshalMessage({
                method: properties.METHOD_KEY.REGISTER_FOR_SEAT_UPDATE,
                params: [ipAddress, port, 60000, request.params[0]],
                id: `${port}${process.id}REGISTOR${request.params[0]}`
            });
            UTILS.sendResponse(server, UTILS.marshalMessage({res: 'ok'}), rinfo);
            server.send(req, properties.lbPort, properties.serverIP, (err) => {
                if (err) {
                    console.error('Error sending request:', err);
                    server.close();
                } else {
                    server.once('message', (msg) => {
                        const response = UTILS.unmarshalMessage(msg);
                        if (response.error) console.log(`Error: ${response.error}`)
                        if (response.res) {
                            console.log(`Res: Server has registered client at ${port} `)
                            UTILS.sendResponse(server, UTILS.marshalMessage({ res: 'ok' }), rinfo);
                        }
                        // client.close();
                    });
                }
            });
        }else{
            console.log(request)
        }
    });

    server.on('error', (err) => {
        console.log(`Server error on port ${port}:`, err);
        server.close();
    });

    server.bind({ port: port, exclusive: true }, () => {
        // server.addMembership('localhost');
        console.log(`Flight Monitor is listening on port ${port}`);
    });
}