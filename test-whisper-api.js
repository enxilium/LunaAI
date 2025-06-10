const fs = require('fs');
const path = require('path');

// Use the fixed version of the speech recognition service
const getSpeechRecognitionService = require('./src/main/services/speech-recognition-fixed');

// Function to read a WAV file and convert to Float32Array
function readWavFile(filePath) {
  console.log(`Reading WAV file: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  
  // Skip WAV header (44 bytes) and convert to Float32Array
  // This assumes 16-bit PCM WAV format
  const headerSize = 44;
  const samples = new Int16Array(buffer.buffer, buffer.byteOffset + headerSize);
  const float32 = new Float32Array(samples.length);
  
  // Normalize to -1.0 to 1.0 range
  for (let i = 0; i < samples.length; i++) {
    float32[i] = samples[i] / 32768.0;
  }
  
  console.log(`Converted ${float32.length} samples to Float32Array`);
  return float32;
}

async function testWhisperAPI() {
  try {
    // Find a sample WAV file to test
    const samplePath = path.join(__dirname, 'samples', 'jfk.wav');
    
    if (!fs.existsSync(samplePath)) {
      console.error(`Sample file not found: ${samplePath}`);
      console.log('Please ensure you have a WAV file to test with.');
      return;
    }
    
    // Load audio data
    const audioData = readWavFile(samplePath);
    
    // Initialize speech recognition service
    console.log('Initializing speech recognition service...');
    const speechRecognitionService = await getSpeechRecognitionService();
    
    // Perform transcription
    console.log('Transcribing audio...');
    const result = await speechRecognitionService.transcribe(audioData);
    
    // Print results
    console.log('\nTranscription Result:');
    console.log('-----------------');
    console.log(`Text: ${result.text}`);
    console.log('\nSegments:');
    if (result.segments && result.segments.length > 0) {
      result.segments.forEach((segment, i) => {
        console.log(`[${i}] ${segment.text}`);
      });
    } else {
      console.log('No segments found');
    }
    
  } catch (error) {
    console.error('Error testing Whisper API:', error);
  }
}

// Run the test
testWhisperAPI(); 