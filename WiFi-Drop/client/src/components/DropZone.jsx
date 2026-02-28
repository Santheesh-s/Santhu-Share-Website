import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export function DropZone({ onFileDrop, disabled }) {
    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles && acceptedFiles.length > 0) {
            onFileDrop(acceptedFiles[0]);
        }
    }, [onFileDrop]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        disabled
    });

    return (
        <div
            {...getRootProps()}
            className={`dropzone glass-panel ${isDragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
            <input {...getInputProps()} />
            <div className="dropzone-icon">
                <svg xmlns="http://www.w3.org/.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
            </div>
            {
                isDragActive ?
                    <p>Drop the file here ...</p> :
                    <p>Drag & drop a file here, or click to select</p>
            }
            {disabled && <p style={{ fontSize: '0.8rem', marginTop: '10px', color: '#ffb347' }}>Connect to a peer first to send files</p>}
        </div>
    );
}
