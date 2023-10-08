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

const dispatcher = new HttpDispatcher();
const wsserver = http.createServer(handleRequest);
const isFileWritten = false

const HTTP_SERVER_PORT = 8080;

function log(message, ...args) {
  console.log(new Date(), message, ...args);
}

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
    this.transcriber = new TranscriptionService();
    this.transcriber.on('transcription', async (transcription) => {
      log(`Transcription : ${transcription}`);
      //this.replyWithEcho()
      const audioBuffer = await this.tts.synthesize(transcription)
      this.replyWithAudio(audioBuffer)
    })

    connection.on('message', this.processMessage.bind(this));
    connection.on('close', this.close.bind(this));
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
    console.log("streamSid: " + this.streamSid)

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
