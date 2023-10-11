const fs = require('fs')
const childProcess = require('child_process')

class Mp3ToMulawConverter {
  static convert(inputStream, options = {}) {
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
      options.onChunkConverted(data)
    });
  
    inputStream.pipe(ffmpeg.stdin);
  
    inputStream.on('end', () => {
      ffmpeg.stdin.end();
      options.onFinished()
    })
  }

}

module.exports = Mp3ToMulawConverter