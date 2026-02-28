import React from 'react';

export function ProgressBar({ progress, filename, filesize, isReceiving }) {
    if (progress === null || progress === undefined || !filename) return null;

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="progress-container glass-panel">
            <div className="progress-info">
                <span>{isReceiving ? 'Receiving:' : 'Sending:'} {filename}</span>
                <span>{progress}%</span>
            </div>
            <div className="progress-bar-bg">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#a0a0a0', textAlign: 'right' }}>
                {formatSize(filesize)}
            </div>
        </div>
    );
}
