import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SIGNALING_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '/';

export function useWebRTC() {
    const [peers, setPeers] = useState([]);
    const [connectedPeer, setConnectedPeer] = useState(null);
    const [transferProgress, setTransferProgress] = useState(0);
    const [receivedFileUrl, setReceivedFileUrl] = useState(null);
    const [isReceiving, setIsReceiving] = useState(false);
    const [currentFile, setCurrentFile] = useState(null);

    const socketRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const dataChannelRef = useRef(null);

    // File receiving buffers
    const receiveBufferRef = useRef([]);
    const receivedSizeRef = useRef(0);
    const expectedSizeRef = useRef(0);
    const metaDataRef = useRef(null);

    useEffect(() => {
        // Initialize Socket.io connection
        socketRef.current = io(SIGNALING_SERVER_URL);

        // Auto-generate a device name
        const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const deviceName = `Device-${randomId}`;

        socketRef.current.emit('register', { deviceName });

        socketRef.current.on('available-peers', (availablePeers) => {
            setPeers(availablePeers);
        });

        socketRef.current.on('peer-joined', (peer) => {
            setPeers((prev) => [...prev, peer]);
        });

        socketRef.current.on('peer-left', (peerId) => {
            setPeers((prev) => prev.filter((p) => p.id !== peerId));
            if (connectedPeer === peerId) {
                handleDisconnect();
            }
        });

        socketRef.current.on('signal', async (data) => {
            const { from, signal } = data;

            if (!peerConnectionRef.current) {
                createPeerConnection(from);
            }

            try {
                if (signal.type === 'offer') {
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
                    const answer = await peerConnectionRef.current.createAnswer();
                    await peerConnectionRef.current.setLocalDescription(answer);
                    socketRef.current.emit('signal', {
                        to: from,
                        signal: peerConnectionRef.current.localDescription
                    });
                } else if (signal.type === 'answer') {
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
                } else if (signal.candidate) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
                }
            } catch (err) {
                console.error('Error handling signal:', err);
            }
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            handleDisconnect();
        };
    }, []);

    const createPeerConnection = (targetPeerId) => {
        // We only use standard STUN servers to gather candidates, but priority is given to host (local) candidates by default in WebRTC
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(configuration);
        peerConnectionRef.current = pc;
        setConnectedPeer(targetPeerId);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Log local candidates for debugging network isolation
                if (event.candidate.candidate.includes('typ host')) {
                    console.log('Local ICE candidate found (WiFi prioritized!):', event.candidate.candidate);
                }
                socketRef.current.emit('signal', {
                    to: targetPeerId,
                    signal: { candidate: event.candidate }
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                handleDisconnect();
            }
        };

        // Listen for incoming data channel (receiver side)
        pc.ondatachannel = (event) => {
            const receiveChannel = event.channel;
            setupDataChannel(receiveChannel);
        };

        return pc;
    };

    const setupDataChannel = (channel) => {
        dataChannelRef.current = channel;
        channel.binaryType = 'arraybuffer';

        channel.onopen = () => {
            console.log('Data channel is open');
        };

        channel.onmessage = (event) => {
            if (typeof event.data === 'string') {
                // Metadata message
                const meta = JSON.parse(event.data);
                if (meta.type === 'file-meta') {
                    metaDataRef.current = meta;
                    expectedSizeRef.current = meta.size;
                    receivedSizeRef.current = 0;
                    receiveBufferRef.current = [];
                    setIsReceiving(true);
                    setTransferProgress(0);
                    setCurrentFile({ name: meta.name, size: meta.size });
                } else if (meta.type === 'file-done') {
                    // Transfer complete
                    const blob = new Blob(receiveBufferRef.current, { type: metaDataRef.current.fileType });
                    const url = URL.createObjectURL(blob);
                    setReceivedFileUrl(url);
                    setIsReceiving(false);
                    setTransferProgress(100);
                    console.log('File received completely');
                }
            } else {
                // Binary data chunk
                receiveBufferRef.current.push(event.data);
                receivedSizeRef.current += event.data.byteLength;
                const progress = Math.round((receivedSizeRef.current / expectedSizeRef.current) * 100);
                setTransferProgress(progress);
            }
        };

        channel.onclose = () => {
            console.log('Data channel closed');
        };
    };

    const connectToPeer = async (peerId) => {
        const pc = createPeerConnection(peerId);

        // Create data channel (sender side)
        const dataChannel = pc.createDataChannel('fileTransfer');
        setupDataChannel(dataChannel);

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit('signal', {
                to: peerId,
                signal: pc.localDescription
            });
        } catch (err) {
            console.error('Error creating offer:', err);
        }
    };

    const sendFile = async (file) => {
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
            alert('Must be connected to a peer first!');
            return;
        }

        setCurrentFile({ name: file.name, size: file.size });
        setTransferProgress(0);

        // Send metadata
        const metaMessage = JSON.stringify({
            type: 'file-meta',
            name: file.name,
            size: file.size,
            fileType: file.type
        });
        dataChannelRef.current.send(metaMessage);

        // Chunk size: 16KB is safe for WebRTC Data Channels across browsers
        const chunkSize = 16384;
        const fileReader = new FileReader();
        let offset = 0;

        fileReader.onerror = error => console.error('Error reading file:', error);
        fileReader.onabort = () => console.log('File reading aborted');

        // Recursive function to read and slice the file
        const readSlice = (o) => {
            const slice = file.slice(offset, o + chunkSize);
            fileReader.readAsArrayBuffer(slice);
        };

        fileReader.onload = (e) => {
            const chunk = e.target.result;

            // Wait if buffer is full
            if (dataChannelRef.current.bufferedAmount > dataChannelRef.current.bufferedAmountLowThreshold) {
                dataChannelRef.current.onbufferedamountlow = () => {
                    dataChannelRef.current.onbufferedamountlow = null;
                    sendChunk(chunk);
                };
            } else {
                sendChunk(chunk);
            }
        };

        const sendChunk = (chunk) => {
            dataChannelRef.current.send(chunk);
            offset += chunk.byteLength;

            const progress = Math.round((offset / file.size) * 100);
            setTransferProgress(progress);

            if (offset < file.size) {
                readSlice(offset);
            } else {
                // Send completion message
                dataChannelRef.current.send(JSON.stringify({ type: 'file-done' }));
                setTransferProgress(100);
            }
        };

        readSlice(0);
    };

    const handleDisconnect = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }
        setConnectedPeer(null);
        setTransferProgress(0);
        setIsReceiving(false);
        setCurrentFile(null);
        setReceivedFileUrl(null);
        receiveBufferRef.current = [];
    };

    return {
        peers,
        connectedPeer,
        connectToPeer,
        sendFile,
        transferProgress,
        receivedFileUrl,
        isReceiving,
        currentFile,
        disconnect: handleDisconnect
    };
}
