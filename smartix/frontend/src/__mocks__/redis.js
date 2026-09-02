const createClient = () => ({
  get: () => Promise.resolve(null),
  set: () => Promise.resolve('OK'),
  del: () => Promise.resolve(1),
  connect: () => Promise.resolve(),
  quit: () => Promise.resolve(),
  on: () => {},
});

module.exports = { createClient };
module.exports.default = { createClient };
