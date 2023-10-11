const childProcess = require("child_process")

const run = () => {
  const cmd = `twilio api:core:calls:create --from="+14382998502" --to="+16479669452" --url="https://${process.env.TWILIO_STREAM_URL}/twiml"`
  console.log(cmd)
  childProcess.execSync(cmd)
}

run()