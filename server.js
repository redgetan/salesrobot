"use strict";
require('dotenv').load();

const fs = require('fs');
const path = require('path');
const http = require('http');
const HttpDispatcher = require('httpdispatcher');
const WebSocketServer = require('websocket').server;
const TranscriptionService = require('./transcription-service');
const DeepgramClient = require('./deepgram_client');
const TextToSpeech = require('./tts');
const { OpenAI } = require("langchain/llms/openai")
const { BufferMemory } = require("langchain/memory")
const { ConversationChain } = require("langchain/chains")
const { ChatPromptTemplate, MessagesPlaceholder } = require("langchain/prompts")


const dispatcher = new HttpDispatcher();
const wsserver = http.createServer(handleRequest);
const isFileWritten = false

const HTTP_SERVER_PORT = 8080;

function log(message, ...args) {
  console.log(new Date(), message, ...args);
}


const model = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const memory = new BufferMemory({ returnMessages: true, memoryKey: "history" });

const systemMessage = `
  You are a business develop representative working for CallerAI. In the following conversation you are calling a potential lead and would like to book a meeting with them next Monday. Here are instructions to help you make a good cold call:\n- Start the call with the following line: \"Hello, [PROSPECTS NAME]. This is [YOUR NAME] from [COMPANY]. Do you have a minute to spare?\"\n- If they are open to hearing more respond with this line: \"I wanted to give you a quick call because we are working with a few companies similar to yours who are looking to increase their outreach numbers, and that is what we do. Actually, we do it using AI coldcallers like this. Do you have a few minutes to talk about the different ways we can help you get [Company Name] where you want it to be?”\n- Not at the start of the call, but somewhere towards the beginning, introduce yourself as Steven an AI agent\n- Have a casual tone and use words like \"Umm\", \"you know\", \"what do you think?\", when talking in order to keep a friendly tone with the speaker.\n- Keep your responses short and try to engage the lead with questions to whether this would be useful for them.\n- If the person does not have time to listen, you must quickly mention that you are an AI agent helping companies like theirs get meetings booked. Ask if you would like the account executive call them back.\n- Your account executive is called Reggie and he will be the person you are trying to book meetings for.\n- If the person wants to talk to a human, say sure how about I get Reggie to call you back. \n- Keep all of your answers in 1 sentence.\n- Dont repeat yourself.\n- Every time you get to speak try to say a little more about the business to get the individual interested. - - Answer their questions.\n- If they are interested, immediately schedule a meeting.\n- If they immediately say that are busy or not interested without having heard anything about the product please tell them you are an AI calling agent. See if this is something they would be interested in hearing about. This is important, if at the start of the conversation the person says they do not want to talk you still need to explain what we do to see if they are interested.\n- When scheduling a meeting suggest 2 time slots for a 30min call.\n- When you are scheduling a call back, mention that this time you will make sure Reggie gets in touch with them and that it wont be the AI calling back.\n- When someone ends a call and says \"good bye\" or anything similar, you can just say \"Have a great rest of your day, bye bye.\"\n\nHere are ways to handle objections from the user:\n\n\nUser: \"I dont have time to talk right now.\"\nAssistant: \"Yeah no problem, listen quickly what we do is use AI for cold calling, Im one of these AIs by the way. Can I call you back tomorrow around noon? Umm actually, you know what, Ill ask Reggie to call you.\"\n\nUser: \"Im busy.\"\nAssistant: \"Ok, so you know, what we do is create custom AI agents that can do outreach for your business. Im one of these AI cold callers by the  way. Can I call you back tomorrow around noon? Or would you prefer if Reggie, our account executive, gives you a call?\"\n\nUser: \"Im not interested.\"\nAssistant: \"Ah alright, well you know its a competitive market and I think tools like these give a real edge these. What about 15min early next week with our account executive? What do you think, can you make the time?\"\n\nUser: \"What is the cost or price of this product?\"\nAssistant: \"Depending on how many simultaneous lines you want our AI callers to do for you the price starts at $2,000 per month.\"\n\nUser: “Ok tell me a little more”\nAssistant: \"Absolutely, so we basically are training AIs to be able to handle gatekeepers and objections and get you meetings. Can you explain what you’re using now and what results you’re getting as far as cold call outreach goes?\"\n\nAfter the prospect explains their process, respond with something like this:\n\"Good news. We should be able to help you via our AI Cold Callers. Are you available [DATE] to meet with me and Reggie, who’s our account executive, to explain how our features could be implemented with your current setup?\"\n\n\n\nHere is information about the business:\nName: CallerAI\nProduct: AI cold caller and meeting scheduler\nPrice: Between $2,000 and $5,000 per month\nDescription: An AI agent capable understanding your product, understanding what makes each lead unique and catering a pitch to them in order to book sales meetings.\n\nHere is information about the individual you are calling:\nName: William Grigat\nCompany: Novisto. ESG Data management software company.\nRole: Junior Product Owner\nLocation: Montreal
`

const chatPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "The following is a friendly conversation between a human and an AI. The AI is direct to the point and uses short sentence to answer queries. If the AI does not know the answer to a question, it truthfully says it does not know.",
  ],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

const chain = new ConversationChain({ 
  llm: model, 
  memory: memory,
  prompt: chatPrompt,
});

// const deepgramClient = new DeepgramClient()

// let replyStart = 0

const mediaws = new WebSocketServer({
  httpServer: wsserver,
  autoAcceptConnections: true,
});


function handleRequest(request, response){
  try {
    dispatcher.dispatch(request, response);
  } catch(err) {
    console.error(err);
  }
}

dispatcher.onGet('/', function(req,res) {
  log('index');
  try {
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    });

    res.end('hello world');
  } catch(e) {
    console.error(e);
    res.writeHead(500);
    res.end();
  }
});

dispatcher.onGet('/ping', function(req,res) {
  log('ping');
  try {
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    });

    res.end('pong');
  } catch(e) {
    console.error(e);
    res.writeHead(500);
    res.end();
  }
});

dispatcher.onPost('/twiml', function(req,res) {
  log('POST TwiML');
  try {
    var filePath = path.join(__dirname+'/templates', 'streams.xml');
    var stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Content-Length': stat.size
    });

    var readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch(e) {
    console.error(e);
    res.writeHead(500);
    res.end();
  }
});

mediaws.on('connect', function(connection) {
  log('Media WS: Connection accepted');
  new MediaStreamHandler(connection);
});

const REPEAT_THRESHOLD = 50;

class MediaStreamHandler {
  constructor(connection) {
    this.metaData = null;
    this.trackHandlers = {};
    this.connection = connection
    this.messages = []
    this.repeatCount = 0
    this.tts = new TextToSpeech();
    this.history = []
    this.transcriber = new TranscriptionService();
    this.transcriber.on('transcription', async (transcription) => {
      log(`Transcription : ${transcription}`);
      //this.replyWithEcho()
      this.history.push(transcription)
      const reply = await this.getChatGPTReply(transcription)

      this.history.push(reply)
      console.log(reply)

      const audioBuffer = await this.tts.synthesize(reply)
      this.replyWithAudio(audioBuffer)
    })

    connection.on('message', this.processMessage.bind(this));
    connection.on('close', this.close.bind(this));
  }

  async getChatGPTReply(message) {

    const startTime = Date.now()

    const response = await chain.call({
      input: message,
    });

    const duration = Date.now() - startTime
    console.log("chatgpt took " + duration + "ms")

    return response.response.replace(/.*AI:/g,'').trim()
  }

  repeat() {
    const messages = [...this.messages];
    this.messages = [];
    const streamSid = messages[0].streamSid;

    // Decode each message and store the bytes in an array
    const messageByteBuffers = messages.map((msg) =>
      Buffer.from(msg.media.payload, "base64")
    );
    // Combine all the bytes, and then base64 encode the entire payload.
    const payload = Buffer.concat(messageByteBuffers).toString("base64");
    const message = {
      event: "media",
      streamSid,
      media: {
        payload,
      },
    };
    const messageJSON = JSON.stringify(message);
    const payloadRE = /"payload":"[^"]*"/gi;
    log(
      `To Twilio: A single media event containing the exact audio from your previous ${messages.length} inbound media messages`,
      messageJSON.replace(
        payloadRE,
        `"payload":"an omitted base64 encoded string with length of ${message.media.payload.length} characters"`
      )
    );
    this.connection.sendUTF(messageJSON);

    // Send a mark message
    const markMessage = {
      event: "mark",
      streamSid,
      mark: {
        name: `Repeat message ${this.repeatCount}`,
      },
    };
    log("To Twilio: Sending mark event", markMessage);
    this.connection.sendUTF(JSON.stringify(markMessage));
    this.repeatCount++;
    if (this.repeatCount === 50) {
      log(`Server: Repeated ${this.repeatCount} times...closing`);
      this.connection.close(1000, "Repeated 5 times");
    }
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

  replyWithEcho(message) {
    const messages = [...this.messages] // do copy instead of reference
    const streamSid = messages[0].streamSid;
    this.messages = []

    const messageByteBuffers = messages.map((msg) =>
      Buffer.from(msg.media.payload, "base64")
    );
    // Combine all the bytes, and then base64 encode the entire payload.
    const payload = Buffer.concat(messageByteBuffers).toString("base64");
    this.connection.sendUTF(JSON.stringify({
      streamSid,
      event: "media",
      media: {
        payload: payload
      }
    }))

    // send mark
    // const markMessage = {
    //   event: "mark",
    //   streamSid,
    //   mark: {
    //     name: `echo message`,
    //   },
    // };
    // log("To Twilio: Sending mark event", markMessage);
    // this.connection.sendUTF(JSON.stringify(markMessage));
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
          if (this.streamSid !== data.streamSid) {
            this.streamSid = data.streamSid
            console.log("streamSid is " + this.streamSid)
          }
          // if (replyStart > 0) {
          //   const now = Date.now()
          //   const diff = now - replyStart
          //   log(`Echo Reply took ${diff}ms`)
          //   replyStart = 0
          // }

          // this.messages.push(data);

          // if (this.messages.length >= REPEAT_THRESHOLD) {
          //   log(`From Twilio: ${this.messages.length} omitted media messages`);
          //   replyStart = Date.now()

          //   // const messageByteBuffers = this.messages.map((msg) =>
          //   //   Buffer.from(msg.media.payload, "base64")
          //   // );
          //   // // Combine all the bytes, and then base64 encode the entire payload.
          //   // const audioBuffer = Buffer.concat(messageByteBuffers)

          //   // const transcription = await deepgramClient.transcribe(audioBuffer)
          //   // console.log("transcription", transcription)

            // this.replyWithEcho();
          // }

          this.transcriber.send(data.media.payload);
        }

      } else if (message.type === 'binary') {
        log('Media WS: binary message received (not supported)');
      }
    } catch(e) {
      console.log("crashed..")
      console.error(e)
    }
  }

  close(){
    log('Media WS: closed');

    for (let track of Object.keys(this.trackHandlers)) {
      log(`Closing ${track} handler`);
      this.trackHandlers[track].close();
    }
  }
}

wsserver.listen(HTTP_SERVER_PORT, function(){
  console.log("Server listening on: http://localhost:%s", HTTP_SERVER_PORT);
});
