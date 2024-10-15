const dgram = require('dgram');
const loadBalancer = dgram.createSocket('udp4');
const UTILS = require('./utils');
const properties = require('./properties.json');

// List of backend servers
const servers = [
    { address: 'localhost', port: 41300, alive: true },
    { address: 'localhost', port: 41301, alive: true },
    { address: 'localhost', port: 41302, alive: true },
    { address: 'localhost', port: 41303, alive: true }
];

const LB_PORT = properties.lbPort;
let serverIndex = 0;  
const pingInterval = 15000; 
const timeout = 2000; 

const pingServers = () => {
    servers.forEach((server, index) => {
        const pingMessage = UTILS.marshalMessage({method: 'ping'});
        const pingSocket = dgram.createSocket('udp4');

        // Send ping to the backend server
        pingSocket.send(pingMessage, server.port, server.address, (err) => {
            if (err) {
                console.error(`Error sending ping to ${server.address}:${server.port}`, err);
                server.alive = false;
            }
        });

        // Set a timeout for pong response
        const pongTimeout = setTimeout(() => {
            server.alive = false; 
            pingSocket.close();
        }, timeout);

        // Listen for pong response
        pingSocket.on('message', (msg) => {
            if (UTILS.unmarshalMessage(msg).res === 'pong') {
                server.alive = true; 
                clearTimeout(pongTimeout);
            }
            pingSocket.close();
        });

        pingSocket.on('error', (err) => {
            console.error(`Ping socket error for ${server.address}:${server.port}`, err);
            clearTimeout(pongTimeout);
            server.alive = false;
            pingSocket.close();
        });
    });
};

// Run the pingServers function at the specified interval
setInterval(pingServers, pingInterval);

loadBalancer.on('message', (msg, clientInfo) => {
    // Filter alive servers
    const aliveServers = servers.filter(server => server.alive);
    if (aliveServers.length === 0) {
        console.log('No backend servers are alive');
        return;
    }

    // Select the next backend server using round-robin
    const server = aliveServers[serverIndex % aliveServers.length];
    serverIndex++;

    console.log(`Forwarding request from ${clientInfo.address}:${clientInfo.port} to backend ${server.address}:${server.port}`);

    // Create a temporary socket for forwarding to backend server
    const backendSocket = dgram.createSocket('udp4');

    // Forward the client message to the selected backend server
    backendSocket.send(msg, server.port, server.address, (err) => {
        if (err) {
            console.error(`Error forwarding to backend ${server.address}:${server.port}`, err);
            backendSocket.close();
        }
    });

    // Listen for response from backend server
    backendSocket.on('message', (response) => {
        // Send the backend response back to the client
        loadBalancer.send(response, clientInfo.port, clientInfo.address, (err) => {
            if (err) {
                console.error('Error sending response back to client:', err);
            }
            backendSocket.close(); 
        });
    });

    backendSocket.on('error', (err) => {
        console.error(`Backend socket error for ${server.address}:${server.port}`, err);
        backendSocket.close();
    });
});

loadBalancer.bind(LB_PORT, '0.0.0.0', () => {
    console.log(`UDP Load Balancer is listening on port ${LB_PORT}`);
});