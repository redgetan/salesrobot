const axios = require('axios');
const xml2js = require('xml2js');
const WebSocket = require('ws');

const sendMediaPayload = (ws) => {
  const message = JSON.stringify({
    type: 'utf8',
    event: 'media',
    streamSid: '1425321',
    media: {
      paylod: 'hello world'
      // Your media data here
    },
  });

  ws.send(message);
}

const connectWebsocket = (url) => {
  // Create a WebSocket connection to the extracted URL
  const ws = new WebSocket(url);

  // WebSocket event handlers
  ws.on('open', () => {
    console.log('WebSocket connection is open');
    sendMediaPayload(ws)
  });

  ws.on('message', (data) => {
    console.log('Received WebSocket data:', data);
    // Handle WebSocket data as needed
  });

  ws.on('close', () => {
    console.log('WebSocket connection is closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

async function fetchData() {
  try {
    // Make a POST request to the local HTTP endpoint
    const response = await axios.post(`https://${process.env.TWILIO_STREAM_URL}/twiml`, {});

    // Extract the response data as a string
    const xmlResponse = response.data;

    // Parse the XML response into a JavaScript object
    const parser = new xml2js.Parser();
    parser.parseString(xmlResponse, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return;
      }

      // Extract the Stream URL from the parsed object
      const streamUrl = result.Response.Connect[0].Stream[0].$.url;
      console.log('Stream URL:', streamUrl);
      connectWebsocket(streamUrl)
    });
  } catch (error) {
    console.error('Error making the POST request:', error);
  }
}

fetchData();