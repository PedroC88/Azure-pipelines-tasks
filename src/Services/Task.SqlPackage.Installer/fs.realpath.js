// fs.realpath polyfill for Node.js 16+ compatibility
// Node.js 16+ moved fs.realpath to internal modules
// This polyfill ensures compatibility with dependencies that require fs.realpath

const fs = require('fs');

// Use the native fs.realpath if available
if (fs.realpath && fs.realpath.native) {
  module.exports = fs.realpath.native;
  module.exports.native = fs.realpath.native;
} else if (fs.realpath) {
  module.exports = fs.realpath;
  module.exports.native = fs.realpath;
} else {
  // Fallback implementation
  module.exports = function realpath(path, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    try {
      const resolved = fs.realpathSync(path, options);
      if (callback) {
        process.nextTick(() => callback(null, resolved));
      }
      return resolved;
    } catch (err) {
      if (callback) {
        process.nextTick(() => callback(err));
      } else {
        throw err;
      }
    }
  };

  module.exports.native = module.exports;
}
