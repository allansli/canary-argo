// receiver/index.js (supports both v1 and v2)
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const packageDefinition = protoLoader.loadSync('receiver.proto', {});
const receiverProto = grpc.loadPackageDefinition(packageDefinition).receiver;

function handleCallV1(call, callback) {
  callback(null, { message: `Hello from receiver v1, got: ${call.request.data}` });
}

function handleCallV2(call, callback) {
  // v2 expects an extra parameter
  if (!call.request.extra) {
    return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Missing extra parameter for v2' });
  }
  callback(null, { message: `Hello from receiver v2, got: ${call.request.data}, extra: ${call.request.extra}` });
}

function main() {
  const server = new grpc.Server();
  server.addService(receiverProto.Receiver.service, {
    call: (call, callback) => {
      // only allow request if x-version matches VERSION env
      if (call.metadata.get('x-version')[0] !== process.env.VERSION) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Version mismatch' });
      }
      // Route based on x-version header
      const version = call.metadata.get('x-version')[0] || 'v1';
      if (version === 'v2') {
        handleCallV2(call, callback);
      } else {
        handleCallV1(call, callback);
      }
    }
  });
  const port = process.env.PORT || '50051';
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`Receiver listening on ${port}`);
    server.start();
  });
}

main();
