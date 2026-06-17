// Force TTY detection so EAS CLI runs in interactive mode
Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true, configurable: true });
Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true, configurable: true });
Object.defineProperty(process.stderr, 'isTTY', { value: true, writable: true, configurable: true });

function patchStream(stream) {
  if (!stream.getWindowSize) stream.getWindowSize = () => [120, 40];
  stream.columns = 120;
  stream.rows = 40;
  if (!stream.clearLine) stream.clearLine = (dir, cb) => { if (cb) cb(); return true; };
  if (!stream.cursorTo) stream.cursorTo = (x, y, cb) => { if (typeof y === 'function') y(); else if (cb) cb(); return true; };
  if (!stream.moveCursor) stream.moveCursor = (dx, dy, cb) => { if (cb) cb(); return true; };
  if (!stream.clearScreenDown) stream.clearScreenDown = (cb) => { if (cb) cb(); return true; };
}
patchStream(process.stdout);
patchStream(process.stderr);

if (!process.stdin.setRawMode) process.stdin.setRawMode = () => process.stdin;

const Module = require('module');
const origResolve = Module._resolveFilename;
let promptsPatched = false;

Module._resolveFilename = function(request, parent, isMain, options) {
  const result = origResolve.call(this, request, parent, isMain, options);

  if (!promptsPatched && request === 'prompts' && parent && parent.filename && parent.filename.includes('eas-cli')) {
    promptsPatched = true;
    const realPrompts = require(result);

    const patchedPrompts = async function(questions, opts) {
      const qs = Array.isArray(questions) ? questions : [questions];
      const answers = {};
      for (const q of qs) {
        const name = q.name || 'value';
        const msg = String(q.message || '');
        const choices = q.choices || [];

        // Log all choices for debugging
        if (choices.length > 0) {
          console.log(`[auto] Prompt: "${msg}" | Choices: ${JSON.stringify(choices.map((c,i) => ({i, title: c.title, value: c.value})))}`);
        }

        if (q.type === 'confirm' || q.type === 'toggle') {
          answers[name] = q.initial !== undefined ? q.initial : true;
          console.log(`[auto] -> ${answers[name]}`);

        } else if (q.type === 'select') {
          let idx = q.initial || 0;

          // Apple Team Type: pick Individual
          if (msg.toLowerCase().includes('team type') || msg.toLowerCase().includes('apple team')) {
            const indIdx = choices.findIndex(c => {
              const label = String(c.title || c.value || '').toLowerCase();
              return label.includes('individual');
            });
            if (indIdx >= 0) idx = indIdx;
            else idx = choices.length - 1; // Individual is often last
          }

          // Generate/create new credentials
          if (msg.toLowerCase().includes('generate') || msg.toLowerCase().includes('create') ||
              msg.toLowerCase().includes('distribution') || msg.toLowerCase().includes('certificate') ||
              msg.toLowerCase().includes('provisioning')) {
            const genIdx = choices.findIndex(c => {
              const label = String(c.title || c.value || '').toLowerCase();
              return label.includes('generate') || label.includes('create') || label.includes('new');
            });
            if (genIdx >= 0) idx = genIdx;
          }

          const choice = choices[idx];
          answers[name] = choice ? choice.value : undefined;
          console.log(`[auto] -> selected idx ${idx}: ${choice ? choice.title || choice.value : 'default'}`);

        } else if (q.type === 'text') {
          answers[name] = q.initial || '';
          console.log(`[auto] ${msg} -> "${answers[name]}"`);

        } else {
          answers[name] = q.initial !== undefined ? q.initial : true;
          console.log(`[auto] ${msg} -> ${answers[name]}`);
        }
      }
      return answers;
    };

    Object.keys(realPrompts).forEach(k => { patchedPrompts[k] = realPrompts[k]; });

    const mod = require.cache[result];
    if (mod) {
      mod.exports = patchedPrompts;
      mod.exports.default = patchedPrompts;
      mod.exports.prompts = realPrompts.prompts;
    }
  }

  return result;
};

const origRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  const result = origRequire.call(this, id);
  if (this.filename && this.filename.includes('eas-cli') && this.filename.endsWith('prompts.js')) {
    if (result.pressAnyKeyToContinueAsync) {
      result.pressAnyKeyToContinueAsync = async () => {};
    }
  }
  return result;
};

require('C:\\Users\\44785\\AppData\\Roaming\\npm\\node_modules\\eas-cli\\bin\\run');
