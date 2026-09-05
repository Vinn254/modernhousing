['log', 'warn', 'error', 'info', 'debug'].forEach((method) => {
  (console as any)[method] = () => {};
});
console.trace = () => {};
console.group = () => {};
console.groupCollapsed = () => {};
console.table = () => {};
console.dir = () => {};
console.dirxml = () => {};
console.time = () => {};
console.timeEnd = () => {};
console.assert = () => {};
