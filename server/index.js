const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// In-memory store for peers
// Map<IPAddress, Map<SocketId, UserInfo>>
const peersByIp = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register', (userInfo) => {
        // Extract IP address from socket connection.
        // In local development, this might be '::1' or an IPv4 mapped address (e.g. '::ffff:192.168.1.100')
        const ipAddress = socket.handshake.address;
        console.log(`User ${socket.id} joined from IP: ${ipAddress}`);

        if (!peersByIp.has(ipAddress)) {
            peersByIp.set(ipAddress, new Map());
        }

        const usersInRoom = peersByIp.get(ipAddress);
        // Add user to the room
        usersInRoom.set(socket.id, {
            id: socket.id,
            deviceName: userInfo.deviceName || `Device ${socket.id.substring(0, 4)}`,
        });

        // Notify others in the same IP room about the new user
        socket.join(ipAddress);
        socket.to(ipAddress).emit('peer-joined', usersInRoom.get(socket.id));

        // Send the current list of users in the room to the newly joined user
        const currentPeers = Array.from(usersInRoom.values()).filter(p => p.id !== socket.id);
        socket.emit('available-peers', currentPeers);
    });

    // Relay WebRTC signaling messages
    socket.on('signal', (data) => {
        const { to, signal } = data;
        // Send standard WebRTC signaling data directly to target socket id
        io.to(to).emit('signal', {
            from: socket.id,
            signal: signal
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const ipAddress = socket.handshake.address;

        if (peersByIp.has(ipAddress)) {
            const usersInRoom = peersByIp.get(ipAddress);
            if (usersInRoom.has(socket.id)) {
                usersInRoom.delete(socket.id);
                // Notify others that this user left
                socket.to(ipAddress).emit('peer-left', socket.id);

                // Clean up empty rooms
                if (usersInRoom.size === 0) {
                    peersByIp.delete(ipAddress);
                }
            }
        }
    });
});

// Serve static files from the React app if in production
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));

// Ensure all other non-API routes return the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
