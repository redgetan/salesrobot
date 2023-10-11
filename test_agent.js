const LLMAgent = require("./llm_agent")
const MediaStreamHandler = require("./media_stream_handler")

const logger = require("./logger")

const runGPT = async () => {
  const agent = new LLMAgent()
  await agent.getResponse("hello how are you?", (token) => {
    console.log(token)
  })
}

const runMediaStreamHandler = async () => {
  const mediaStreamHandler = new MediaStreamHandler();
  mediaStreamHandler.streamChatGPTReply("hello how are you?")
}

const run = async () => {
  runMediaStreamHandler()
}

run()