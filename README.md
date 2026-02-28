# WiFi-Drop

WiFi-Drop is a peer-to-peer, database-less web application that allows you to share files between devices on the same local network. It uses WebRTC Data Channels for direct file transfers and Socket.io for peer discovery.

## Features

- **Local Network Discovery**: Devices with the same Public IP are automatically grouped together in the "Nearby Devices" list.
- **P2P Transfer**: Files are transferred directly from browser to browser using WebRTC `RTCDataChannel`.
- **Zero Database**: No user data, passwords, or files are stored on any server. The signaling server purely exists in-memory to route WebRTC handshake data.
- **Beautiful UI**: Built with React, featuring a modern glassmorphism design, drag-and-drop file inputs, and progress bars.

## How Priority is Given to Local WiFi

WebRTC uses **ICE (Interactive Connectivity Establishment)** to find the best path to connect two peers. When the application creates the `RTCPeerConnection`, it gathers ICE candidates. 

In this application, we intentionally avoid configuring TURN (Traversal Using Relays around NAT) servers for data relay. Instead, we only provide a basic public STUN server to evaluate network topology. Because the WebRTC specification mandates that connections prioritize the most direct path with the lowest latency, the API will natively prioritize **"host" candidates** (local IP addresses like `192.168.x.x`) when both devices sit behind the same router. 

As a result, once the initial signaling handshake is negotiated over the internet via the Socket.io server, the actual bulk file data payload flows *exclusively* over the local home or office WiFi router. This guarantees maximum transfer speeds and prevents consuming your internet bandwidth plan for large files.

## Running the App

### Requirements
- Node.js 18+

### Setup
1. Open a terminal and start the server:
   ```bash
   cd server
   npm install
   npm start
   ```
2. Open another terminal and start the client frontend:
   ```bash
   cd client
   npm install
   npm run dev
   ```
3. Open the provided `localhost` or local network URL in two browser tabs/devices to test the file transfer.
