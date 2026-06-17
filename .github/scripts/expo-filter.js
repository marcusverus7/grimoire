#!/usr/bin/env node
// Wrapper for react-native-xcode.sh bundle phase.
// Strips --config-cmd and --entry-file before calling expo export:embed.
//
// --config-cmd: appended by react-native-xcode.sh; passes 'react-native config'.
// --entry-file: xcodebuild passes an absolute pnpm-store path which shifts Metro's
//   worker initialisation context, breaking babel-preset-expo resolution.
// --reset-cache: clears Metro's transform cache so every file must be re-Babel'd
//   in jest-worker processes. Those workers, when spawned inside xcodebuild's
//   stripped environment, cannot resolve babel-preset-expo. The pre-bundle step
//   (run first, without --reset-cache) already populated the Metro cache; reusing
//   that cache means Babel never runs again in the problematic worker context.
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const filtered = [];
let skip = 0;
for (const arg of args) {
  if (skip > 0) { skip--; continue; }
  if (arg === '--config-cmd' || arg === '--entry-file') { skip = 1; continue; }
  if (arg === '--reset-cache') { continue; }  // flag only — no value to skip
  filtered.push(arg);
}
const expoCli = process.env.REAL_EXPO_CLI;
if (!expoCli) {
  console.error('expo-filter.js: REAL_EXPO_CLI env var not set');
  process.exit(1);
}
const result = spawnSync(process.execPath, [expoCli, ...filtered], { stdio: 'inherit' });
process.exit(result.status || 0);
