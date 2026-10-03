// Préchargé avant server.js (voir Dockerfile) : le server.listen(port, "localhost") de Next.js
// écoute en fait sur LISTEN_HOST ; HOSTNAME, qui sert aux URL internes, reste « localhost ».
const net = require('node:net');
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (args[1] === 'localhost' && process.env.LISTEN_HOST) args[1] = process.env.LISTEN_HOST;
  return listen.apply(this, args);
};
