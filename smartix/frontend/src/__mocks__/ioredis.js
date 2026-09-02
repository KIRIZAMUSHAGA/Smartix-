class Redis {
  constructor() {}
  get() { return Promise.resolve(null); }
  set() { return Promise.resolve('OK'); }
  del() { return Promise.resolve(1); }
  expire() { return Promise.resolve(1); }
  quit() { return Promise.resolve('OK'); }
  on() { return this; }
  disconnect() {}
}

module.exports = Redis;
module.exports.default = Redis;
