const fs = require('fs')
const childProcess = require('child_process')

class Mp3ToMulawConverter {
  static convert(inputStream, callback) {
    const spawn = childProcess.spawn;
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',     // Input from stdin (pipe:0)
      '-f', 'mulaw',      // Output format is mu-law
      '-ar', '8000',      // Sample rate of 8000 Hz
      '-ac', '1',         // Mono audio
      'pipe:1'            // Output to stdout (pipe:1)
    ]);
  
    // Handle errors
    ffmpeg.stderr.on('data', (data) => {
      //console.error(`FFMPEG Error: ${data}`);
    });
  
    // Handle the output data (converted mu-law audio)
    ffmpeg.stdout.on('data', (data) => {
      // Do something with the converted audio data, e.g., send it to a stream or a client
      // In this example, we will just log the data
      callback(data)
      //console.log(`Converted audio data: ${data}`);
    });
  
    // const outputWavStream = fs.createWriteStream('mulaw.wav')
  
    // ffmpeg.stdout.pipe(outputWavStream);
  
    // Assuming you have a readable stream as inputStream
    // You can pipe the input stream to ffmpeg's stdin
    inputStream.pipe(ffmpeg.stdin);
  
    // When the input stream ends, close ffmpeg's stdin
    inputStream.on('end', () => {
      ffmpeg.stdin.end();
    })
  }

}

module.exports = Mp3ToMulawConverter