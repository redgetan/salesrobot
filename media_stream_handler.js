const TranscriptionService = require('./transcription_service');
const TextToSpeech = require('./text_to_speech');
const LLMAgent = require('./llm_agent');
const Mp3ToMulawConverter = require('./mp3_to_mulaw_converter')

const logger = require("./logger")

class MediaStreamHandler {
  constructor() {
    this.isSpeaking = false
    this.metaData = null;

    this.messages = []
    this.sentences = []

    this.tts = new TextToSpeech();
    this.llmAgent = new LLMAgent()

    setInterval(this.processAISpeechResponse.bind(this), 200)
  }

  init(connection) {
    this.connection = connection

    this.connection.on('message', this.processMessage.bind(this));
    this.connection.on('close', this.close.bind(this));

    this.initTranscriber()
  }

  initTranscriber() {
    console.log("init transcribe")
    this.transcriber = new TranscriptionService();
    this.transcriber.on('transcription', async (transcription) => {
      logger.info(`Transcription : ${transcription}`);
      
      await this.streamChatGPTReply(transcription)
    })
  }

  async processAISpeechResponse() {
    if (this.isSpeaking) return
    
    let sentence = this.sentences[0]
    if (sentence) {
      console.log("speak sentence")
      await this.speakSentence(sentence)
    }
  }


  async streamChatGPTReply(message) {
    let tokens = []
    let startTime = Date.now()
    let isFirstToken = true
    await this.getChatGPTReply(message, async (data) => {
      if (isFirstToken) {
        isFirstToken = false
        let duration = Date.now() - startTime
        logger.info("GPT first token took " + duration + "ms")
      }

      tokens.push(data.token)

      let isEndOfSentence = ['.','?', '!'].indexOf(data.token) !== -1
      if (isEndOfSentence) {
        let sentence = tokens.join('')
        sentence = sentence.replace(/.*AI:/g,'').trim().replace(/.*Assistant:/g,'').trim()
        tokens = []

        this.addSentence(sentence)
      }
    })
  }

  addSentence(sentence) {
    logger.info(sentence)
    this.sentences.push(sentence)
  }

  moveOnToNextSentence() {
    this.sentences.shift()
  }

  async speakSentence(sentence) {
    this.isSpeaking = true

    let startTime = Date.now()
    let isFirstChunk = true

    const mp3AudioStream = await this.tts.elevenlabsTTS(sentence)

    Mp3ToMulawConverter.convert(mp3AudioStream, {
      onChunkConverted: (mulawAudioBuffer) => {

        if (isFirstChunk) {
          isFirstChunk = false
          let duration = Date.now() - startTime
          logger.info("ElevenLabs Streaming TTS took " + duration + "ms")
        }

        this.replyWithAudio(mulawAudioBuffer)
      },
      onFinished: () => {
        this.isSpeaking = false
        this.moveOnToNextSentence()
      }
    })
  }

  async getChatGPTReply(message, callback) {
    const response = await this.llmAgent.getResponse(message, callback)

    return response
  }

  replyWithAudio(audioBuffer) {
    const payload = audioBuffer.toString("base64");

    this.connection.sendUTF(JSON.stringify({
      streamSid: this.streamSid,
      event: "media",
      media: {
        payload: payload,
      }
    }))
  }

  async processMessage(message){
    try {
      if (message.type === 'utf8') {
        const data = JSON.parse(message.utf8Data);

        if (data.event === "start") {
          this.metaData = data.start;
        }
        if (data.event !== "media") {
          return;
        }
        const track = data.media.track;

        if (data.event === 'media') {
          this.streamSid = data.streamSid
          this.transcriber.send(data.media.payload);
        }

      } else if (message.type === 'binary') {
        logger.info('Media WS: binary message received (not supported)');
      }
    } catch(e) {
      logger.error("crashed..")
      console.error(e)
    }
  }

  close(){
    logger.info('Media WS: closed');
    this.transcriber.close()
  }
}

module.exports = MediaStreamHandler