// fs.realpath polyfill for Node.js compatibility
// Some dependencies may look for this module in node_modules
// This simply re-exports the native fs.realpath which is available in all supported Node.js versions

const fs = require('fs');

// Export the native fs.realpath (always available in Node.js 10+)
module.exports = fs.realpath;
module.exports.native = fs.realpath.native || fs.realpath;
