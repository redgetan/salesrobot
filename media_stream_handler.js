const TranscriptionService = require('./transcription-service');
const TextToSpeech = require('./tts');
const LLMAgent = require('./llm_agent');

const logger = require("./logger")

class MediaStreamHandler {
  constructor(connection) {
    this.connection = connection

    this.metaData = null;
    this.trackHandlers = {};
    this.messages = []
    this.repeatCount = 0
    this.history = []

    this.tts = new TextToSpeech();
    this.llmAgent = new LLMAgent()

    this.connection.on('message', this.processMessage.bind(this));
    this.connection.on('close', this.close.bind(this));

    this.initTranscriber()
  }

  initTranscriber() {
    this.transcriber = new TranscriptionService();
    this.transcriber.on('transcription', async (transcription) => {
      logger.info(`Transcription : ${transcription}`);
      //this.replyWithEcho()
      this.history.push(transcription)
      const reply = await this.getChatGPTReply(transcription)

      this.history.push(reply)
      logger.info(reply)

      const audioBuffer = await this.tts.synthesize(reply)
      this.replyWithAudio(audioBuffer)
    })
  }

  async getChatGPTReply(message) {
    const startTime = Date.now()

    const response = await this.llmAgent.getResponse(message)

    const duration = Date.now() - startTime
    logger.info("chatgpt took " + duration + "ms")

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