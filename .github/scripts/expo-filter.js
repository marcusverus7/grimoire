#!/usr/bin/env node
// Wrapper for react-native-xcode.sh bundle phase.
// Strips --config-cmd and --entry-file before calling expo export:embed.
//
// --config-cmd: appended by react-native-xcode.sh; passes 'react-native config'
//   which can alter Metro's projectRoot in jest-worker processes.
// --entry-file: xcodebuild passes an absolute path into the pnpm virtual store
//   (e.g. node_modules/.pnpm/expo-router@.../entry.js). When Metro sees an entry
//   file outside the projectRoot, it adjusts how workers are initialised and how
//   moduleMapper.js resolves packages, breaking babel-preset-expo resolution.
//   Without --entry-file, expo resolves the entry from package.json "main" field,
//   which matches what the working pre-bundle step does.
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const filtered = [];
let skip = 0;
for (const arg of args) {
  if (skip > 0) { skip--; continue; }
  if (arg === '--config-cmd' || arg === '--entry-file') { skip = 1; continue; }
  filtered.push(arg);
}
const expoCli = process.env.REAL_EXPO_CLI;
if (!expoCli) {
  console.error('expo-filter.js: REAL_EXPO_CLI env var not set');
  process.exit(1);
}
const result = spawnSync(process.execPath, [expoCli, ...filtered], { stdio: 'inherit' });
process.exit(result.status || 0);
