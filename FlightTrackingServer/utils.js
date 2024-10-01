const parseDate = (dateString) => {
    const [datePart, timePart] = dateString.split(' ');
    const [day, month, year] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes); // JS months are 0-indexed
}

const UTILS = {
    marshalMessage: (data) => Buffer.from(JSON.stringify(data)),
    unmarshalMessage: (msg) => JSON.parse(msg.toString()),
    sendResponse: (server, msg, rinfo) => server.send(msg, rinfo.port, rinfo.address, (err) => {
        if (err) console.error('Error sending response:', err);
    }),
    parseDate: parseDate,
    generateFlights: (numberOfFlights) => {
        const airlines = ['TR', 'SQ', 'SA', 'TK', 'SD'];
        const locations = ['Singapore', 'Phuket', 'Hangzhou', 'Taipei', 'Dubai'];

        const generateFlight = () => {
            const airlineCode = airlines[Math.floor(Math.random() * airlines.length)];
            const flightNumber = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
            const flightIdentifier = `${airlineCode}${flightNumber}`;

            const seatLayouts = [
                { layout: [6, 20], capacity: 6 * 20 },
                { layout: [10, 20], capacity: 10 * 20 }
            ];
            const seatLayoutChoice = seatLayouts[Math.floor(Math.random() * seatLayouts.length)];
            const seatLayout = seatLayoutChoice.layout;
            const capacity = seatLayoutChoice.capacity;

            const from = ['Singapore', 'Hangzhou'][Math.floor(Math.random() * 2)];
            let destination;
            do {
                destination = locations[Math.floor(Math.random() * locations.length)];
            } while (destination === from);

            const fare = (Math.random() * (1000 - 100) + 100).toFixed(2);

            const now = new Date();
            const departureDate = new Date(now.getTime() + Math.random() * (1000 * 60 * 60 * 24 * 3));
            const day = String(departureDate.getDate()).padStart(2, '0');
            const month = String(departureDate.getMonth() + 1).padStart(2, '0');
            const year = departureDate.getFullYear();
            const hours = String(departureDate.getHours()).padStart(2, '0');
            let minutes = Math.floor(departureDate.getMinutes() / 5) * 5;
            minutes = String(minutes).padStart(2, '0');
            const departureTime = `${day}-${month}-${year} ${hours}:${minutes}`;

            return {
                flightIdentifier,
                capacity,
                seatLayout,
                fare,
                departureTime,
                from,
                destination
            };
        }

        const flights = [];
        for (let i = 0; i < numberOfFlights; i++) {
            flights.push(generateFlight());
        }

        flights.sort((a, b) => parseDate(a.departureTime) - parseDate(b.departureTime));

        return flights;
    },
    validIpPort: (ip, port) => {
        const portRegex = /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;
        const ipRegex = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|[1-9]?[0-9])$/;
        return ((String(ip).toLowerCase() === 'localhost') || ipRegex.test(ip)) && portRegex.test(port);
    }
}

module.exports = UTILS;