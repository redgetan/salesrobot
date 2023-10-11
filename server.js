"use strict";
require('dotenv').load();

const fs = require('fs');
const path = require('path');
const http = require('http');
const pino = require('pino')
const { Readable } = require('stream');


const logger = pino({
  transport: {
    target: 'pino-pretty'
  },
})

const HttpDispatcher = require('httpdispatcher');
const WebSocketServer = require('websocket').server;
const MediaStreamHandler = require('./media_stream_handler')

const dispatcher = new HttpDispatcher();
const wsserver = http.createServer(handleRequest);
const isFileWritten = false

const HTTP_SERVER_PORT = 8080;

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
  logger.info('index');
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
  logger.info('ping');
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
  logger.info('POST TwiML');
  try {

    var filePath = path.join(__dirname+'/templates', 'streams.xml');
    var stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Content-Length': stat.size
    })

    var readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    return

    let xml = `
      <?xml version="1.0" encoding="UTF-8" ?>
      <Response>
        <Connect>
          <Stream url="wss://${process.env.TWILIO_STREAM_URL}/streams">
            <Parameter name="aCutomParameter" value="aCustomValue that was set in TwiML" />
          </Stream>
        </Connect>
      </Response>\n`

    xml = xml.split('\n') // Split the string into lines
    .map(line => line.replace(/^ {6}/, '')) // Remove the first 6 spaces from each line
    .join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Content-Length': xml.length
    });

    const readableStream = Readable.from(xml)
    readableStream.pipe(res)
  } catch(e) {
    console.error(e);
    res.writeHead(500);
    res.end();
  }
});

mediaws.on('connect', function(connection) {
  logger.info('Media WS: Connection accepted');
  const mediaStreamHandler = new MediaStreamHandler();
  mediaStreamHandler.init(connection)
});

wsserver.listen(HTTP_SERVER_PORT, function(){
  logger.info("Server listening on: http://localhost:%s", HTTP_SERVER_PORT);
});
