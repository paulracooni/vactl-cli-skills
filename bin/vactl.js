#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((err) => {
  console.error('\x1b[31m✗ ' + (err && err.message ? err.message : String(err)) + '\x1b[0m');
  process.exit(1);
});
