import React, { useState, useRef, useEffect } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';

function App() {
    const {
        peers,
        connectedPeer,
        connectToPeer,
        sendFile,
        transferProgress,
        receivedFileUrl,
        isReceiving,
        currentFile,
        disconnect
    } = useWebRTC();

    const handleFileDrop = (file) => {
        if (connectedPeer) {
            sendFile(file);
        }
    };

    const handleDownload = () => {
        if (receivedFileUrl && currentFile) {
            const a = document.createElement('a');
            a.href = receivedFileUrl;
            a.download = currentFile.name;
            a.click();
        }
    };

    return (
        <div className="app-container">
            <header>
                <h1>WiFi-Drop</h1>
                <p style={{ color: '#a0a0a0', fontSize: '1.1rem' }}>Peer-to-Peer file sharing over local WiFi</p>
            </header>

            <main className="main-content">
                <section className="peer-section glass-panel">
                    <h2>Nearby Devices</h2>
                    {peers.length === 0 ? (
                        <p style={{ color: '#808080', fontStyle: 'italic', padding: '20px 0' }}>
                            Searching for devices on your network...
                        </p>
                    ) : (
                        <ul className="peer-list">
                            {peers.map((peer) => (
                                <li
                                    key={peer.id}
                                    className={`peer-item ${connectedPeer === peer.id ? 'active' : ''}`}
                                    onClick={() => !connectedPeer && connectToPeer(peer.id)}
                                >
                                    <span className="peer-name">{peer.deviceName}</span>
                                    {connectedPeer === peer.id ? (
                                        <span className="peer-status">
                                            <div className="status-dot"></div> Connected
                                        </span>
                                    ) : (
                                        <span className="peer-status" style={{ color: '#4facfe' }}>Tap to connect</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    {connectedPeer && (
                        <button
                            onClick={disconnect}
                            style={{ marginTop: '20px', width: '100%', background: 'rgba(255, 100, 100, 0.2)', borderColor: 'rgba(255, 100, 100, 0.4)' }}
                        >
                            Disconnect
                        </button>
                    )}
                </section>

                <section className="transfer-section">
                    <DropZone onFileDrop={handleFileDrop} disabled={!connectedPeer || isReceiving || (transferProgress > 0 && transferProgress < 100)} />

                    {(currentFile || receivedFileUrl) && (
                        <div style={{ marginTop: '20px' }}>
                            <ProgressBar
                                progress={transferProgress}
                                filename={currentFile?.name}
                                filesize={currentFile?.size}
                                isReceiving={isReceiving}
                            />

                            {receivedFileUrl && (
                                <div className="glass-panel" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong>{currentFile?.name}</strong> received successfully!
                                    </div>
                                    <button onClick={handleDownload} style={{ background: 'linear-gradient(45deg, #00f2fe, #4facfe)', border: 'none', fontWeight: 'bold' }}>
                                        Download Source File
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default App;
