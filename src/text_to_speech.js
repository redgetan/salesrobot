const childProcess = require('child_process');
const path = require('path')


const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const WaveFile = require("wavefile").WaveFile;
const axios = require('axios')
const pcmUtil = require('pcm-util');
const logger = require("./logger")

//const wav = require('node-wav');


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
    //console.log('Audio content written to file: output.mp3');
  }

  async synthesize(text) {
    return this.googleTTS(text)
  }

  async elevenlabsTTS(text) {
    const voiceId = '21m00Tcm4TlvDq8ikWAM'
    const baseUrl = 'https://api.elevenlabs.io' 
    const outputFormat = 'mp3_44100'
    //const outputFormat = 'pcm_16000'

    const streamingLatencyOption = 3 // strong latency optimizations (about 75% of possible latency improvement
    const apiPath = `/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=${streamingLatencyOption}&output_format=${outputFormat}`

    const apiKey = process.env.ELEVENLABS_API_KEY

    let startTime = Date.now()
    const response = await axios.post(baseUrl + apiPath, {
      text: text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0,
        similarity_boost: 0,
        style: 0,
        use_speaker_boost: true
      }
    }, {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': "application/json",
        'Accept': "audio/mpeg",
      },
      responseType: "stream",
    })

    // response.data is an mp3 ArrayBuffer. convert it into wav

    let duration = Date.now() - startTime
    logger.info("elevenlabs took " + duration + "ms")

    return response.data
  }

  async googleTTS(text) {
    const request = {
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      audioConfig: { 
        audioEncoding: 'LINEAR16',
      },
    };

    let startTime = Date.now()
    const result = await this.client.synthesizeSpeech(request);
    const [response] = result
    const audioBuffer = response.audioContent

    let duration = Date.now() - startTime
    logger.info("googleTTS took " + duration + "ms")

    const wav = new WaveFile();
    wav.fromBuffer(audioBuffer);
    wav.toSampleRate(8000);
    wav.toMuLaw();

    return Buffer.from(wav.data.samples)
    //this.saveAudio(audioBuffer)
  }

}

module.exports = TextToSpeech