#!/usr/bin/env node
// Wrapper for react-native-xcode.sh bundle phase.
// Strips --config-cmd before calling expo export:embed.
// react-native-xcode.sh appends --config-cmd 'react-native cli.js config' which
// causes Metro to use a different projectRoot in jest-worker processes, breaking
// babel-preset-expo resolution. Without it, expo uses the cwd (apps/mobile)
// as projectRoot — same as our pre-bundle step which works correctly.
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const filtered = [];
let skip = 0;
for (const arg of args) {
  if (skip > 0) { skip--; continue; }
  if (arg === '--config-cmd') { skip = 1; continue; }
  filtered.push(arg);
}
const expoCli = process.env.REAL_EXPO_CLI;
if (!expoCli) {
  console.error('expo-filter.js: REAL_EXPO_CLI env var not set');
  process.exit(1);
}
const result = spawnSync(process.execPath, [expoCli, ...filtered], { stdio: 'inherit' });
process.exit(result.status || 0);
