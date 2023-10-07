"use strict";
require('dotenv').load();

const fs = require('fs');
const path = require('path');
const http = require('http');
const HttpDispatcher = require('httpdispatcher');
const WebSocketServer = require('websocket').server;
const TranscriptionService = require('./transcription-service');

const dispatcher = new HttpDispatcher();
const wsserver = http.createServer(handleRequest);

const HTTP_SERVER_PORT = 8080;

function log(message, ...args) {
  console.log(new Date(), message, ...args);
}

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
    if (this.repeatCount === 5) {
      log(`Server: Repeated ${this.repeatCount} times...closing`);
      this.connection.close(1000, "Repeated 5 times");
    }
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
    const markMessage = {
      event: "mark",
      streamSid,
      mark: {
        name: `echo message`,
      },
    };
    log("To Twilio: Sending mark event", markMessage);
    this.connection.sendUTF(JSON.stringify(markMessage));
  }

  processMessage(message){
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
          this.messages.push(data);
        }

        if (this.trackHandlers[track] === undefined) {
          const service = new TranscriptionService();
          service.on('transcription', (transcription) => {
            log(`Transcription (${track}): ${transcription}`);
            
            this.replyWithEcho()
          })

          this.trackHandlers[track] = service;
        }
        this.trackHandlers[track].send(data.media.payload);
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
