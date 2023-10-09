const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const WaveFile = require("wavefile").WaveFile;

class TextToSpeech {
  constructor() {
    const encodedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const serviceAccountKey = JSON.parse(atob(encodedKey));

    this.client = new textToSpeech.TextToSpeechClient({
      credentials: serviceAccountKey,
    })
  }

  async saveAudio(audioBuffer) {
    const writeFile = util.promisify(fs.writeFile);
    await writeFile('output.mp3', audioBuffer, 'binary');
    console.log('Audio content written to file: output.mp3');
  }

  async synthesize(text) {
    const request = {
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      audioConfig: { 
        audioEncoding: 'LINEAR16',
      },
    };

    const [response] = await this.client.synthesizeSpeech(request);
    const audioBuffer = response.audioContent

    const wav = new WaveFile();
    wav.fromBuffer(audioBuffer);
    wav.toSampleRate(8000);
    wav.toMuLaw();
    return Buffer.from(wav.data.samples)
    //this.saveAudio(audioBuffer)
    return audioBuffer
  }
}

module.exports = TextToSpeech