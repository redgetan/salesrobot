const { Deepgram } = require("@deepgram/sdk");
const fetch = require("cross-fetch");

class DeepgramClient {
  constructor() {
    // Initialize the Deepgram SDK
    this.deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY)
  }

  async transcribe(audioBuffer) {
    const source = {
      buffer: audioBuffer,
      encoding: 'MULAW',
    };

    return this.deepgram.transcription
        .preRecorded(source, {
          smart_format: true,
          model: "nova",
        })
        .then((response) => {
          // Write the response to the console
          console.dir(response, { depth: null });
          return response
      
          // Write only the transcript to the console
          //console.dir(response.results.channels[0].alternatives[0].transcript, { depth: null });
        })
        .catch((err) => {
          console.log(err);
        });
  }
}

module.exports = DeepgramClient


// URL for the audio you would like to stream
// URL for the example resource will change depending on whether user is outside or inside the UK
// Outside the UK
const url = "http://stream.live.vc.bbcmedia.co.uk/bbc_world_service";
// Inside the UK
// const url = 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm';


// Create a websocket connection to Deepgram
// In this example, punctuation is turned on, interim results are turned off, and language is set to UK English.
// const deepgramLive = this.deepgram.transcription.live({
// 	smart_format: true,
// 	interim_results: false,
// 	language: "en-US",
// 	model: "nova",
// });

// // Listen for the connection to open and send streaming audio from the URL to Deepgram
// fetch(url)
// 	.then((r) => r.body)
// 	.then((res) => {
// 		res.on("readable", () => {
// 			if (deepgramLive.getReadyState() == 1) {
// 				deepgramLive.send(res.read());
// 			}
// 		});
// 	});

// // Listen for the connection to close
// deepgramLive.addListener("close", () => {
// 	console.log("Connection closed.");
// });

// // Listen for any transcripts received from Deepgram and write them to the console
// deepgramLive.addListener("transcriptReceived", (message) => {
// 	const data = JSON.parse(message);

// 	// Write the entire response to the console
// 	console.dir(data.channel, { depth: null });

// 	// Write only the transcript to the console
// 	//console.dir(data.channel.alternatives[0].transcript, { depth: null });
// });