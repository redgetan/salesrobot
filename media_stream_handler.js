const TranscriptionService = require('./transcription_service');
const TextToSpeech = require('./text_to_speech');
const LLMAgent = require('./llm_agent');
const Mp3ToMulawConverter = require('./mp3_to_mulaw_converter')

const logger = require("./logger")

class MediaStreamHandler {
  constructor() {
    this.metaData = null;
    this.trackHandlers = {};
    this.messages = []
    this.repeatCount = 0

    this.tts = new TextToSpeech();
    this.llmAgent = new LLMAgent()

  }

  init(connection) {
    this.connection = connection

    this.connection.on('message', this.processMessage.bind(this));
    this.connection.on('close', this.close.bind(this));

    this.initTranscriber()
  }

  initTranscriber() {
    this.transcriber = new TranscriptionService();
    this.transcriber.on('transcription', async (transcription) => {
      logger.info(`Transcription : ${transcription}`);
      
      await this.streamChatGPTReply(transcription)
    })
  }

  async streamChatGPTReply(message) {
    let tokens = []
    await this.getChatGPTReply(message, async (data) => {
      tokens.push(data.token)

      let isEndOfSentence = ['.','?', '!'].indexOf(data.token) !== -1
      if (isEndOfSentence) {
        let sentence = tokens.join('')
        logger.info(sentence)
        tokens = []

        const mp3AudioStream = await this.tts.elevenlabsTTS(sentence)

        Mp3ToMulawConverter.convert(mp3AudioStream, (audioBuffer) => {
          this.replyWithAudio(audioBuffer)
        })
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