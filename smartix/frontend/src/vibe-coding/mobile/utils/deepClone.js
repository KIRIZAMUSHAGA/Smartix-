export const deepClone = (value) => {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Array) return value.map(item => deepClone(item));
  if (value instanceof Map) {
    const clone = new Map();
    value.forEach((v, k) => clone.set(deepClone(k), deepClone(v)));
    return clone;
  }
  if (value instanceof Set) {
    const clone = new Set();
    value.forEach(v => clone.add(deepClone(v)));
    return clone;
  }
  const clone = Object.create(Object.getPrototypeOf(value));
  Object.keys(value).forEach(key => {
    clone[key] = deepClone(value[key]);
  });
  return clone;
};

export default deepClone;
