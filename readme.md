# AI Cold Caller 

This is a prototype of an automated cold caller using Twilio + ChatGPT. 


### Installation

    npm install
    twilio plugins:install @twilio-labs/plugin-serverless

### Running

    npm start

### Testing Twiml streams

    twilio api:core:calls:create --from="<your_twilio_number>" --to="<target_phone_number>" --url="https://bitter-jeans-shave.loca.lt/twiml"



