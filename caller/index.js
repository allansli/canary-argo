// caller/index.js (v1 and v2)
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const packageDefinition = protoLoader.loadSync('receiver.proto', {});
const receiverProto = grpc.loadPackageDefinition(packageDefinition).receiver;

function callReceiver(version, customData, cb) {
  const client = new receiverProto.Receiver(process.env.RECEIVER_ADDR || 'receiver:50051', grpc.credentials.createInsecure());
  const metadata = new grpc.Metadata();
  metadata.add('x-version', version);
  let request;
  if (version === 'v2') {
    request = { data: customData || 'hello from caller v2', extra: 'extra-param' };
  } else {
    request = { data: customData || 'hello from caller v1' };
  }
  client.call(request, metadata, (err, response) => {
    if (cb) return cb(err, response);
    if (err) {
      console.error('Error:', err.message);
    } else {
      console.log('Response:', response.message);
      // Forward response to capturer
      axios.post(process.env.CAPTURER_URL || 'http://capturer:8080/capture', {
        data: response.message
      });
    }
  });
}

function main() {
  // HTTP server to receive requests from capturer
  const app = express();
  app.use(bodyParser.json());

  app.post('/call', (req, res) => {
    const version = process.env.VERSION || 'v1';
    const customData = req.body && req.body.data;
    callReceiver(version, customData, (err, response) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(200).json({ message: response.message });
    });
  });

  const httpPort = process.env.HTTP_PORT || 3000;
  app.listen(httpPort, () => {
    console.log(`Caller HTTP API listening on port ${httpPort}`);
  });

  // Also run the periodic gRPC call as before
  const version = process.env.VERSION || 'v1';
  setInterval(() => {
    callReceiver(version);
  }, 5000);
}

main();
