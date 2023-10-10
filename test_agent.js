const LLMAgent = require("./llm_agent")

const logger = require("./logger")

const run = async () => {
  const agent = new LLMAgent()
  let response = await agent.getResponse("hello how are you?")
  logger.info(response)

  response = await agent.getResponse("yes. what do you want?")
  logger.info(response)
}

run()