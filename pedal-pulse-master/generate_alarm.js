const fs = require('fs');
const path = require('path');

// Simple script to create a valid base64 encoded wav file
// This is a short, loud beep sound
const beepBase64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="; // Minimal valid header, we'll write actual sine wave data

const createWav = () => {
    const sampleRate = 44100;
    const duration = 0.5; // seconds
    const numSamples = sampleRate * duration;
    const buffer = Buffer.alloc(44 + numSamples * 2);

    // Write WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    // Generate intense sine wave (A5 - 880Hz)
    const frequency = 880;
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Square wave for harsher alarm sound
        const sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 32767 : -32768;
        buffer.writeInt16LE(sample, 44 + i * 2);
    }

    const filepath = path.join(__dirname, 'assets', 'sounds', 'alarm.wav');
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, buffer);
    console.log('Created alarm.wav successfully at', filepath);
};

createWav();
