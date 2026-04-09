#!/usr/bin/env node

import { spawn } from 'child_process';
import { select } from './db-select.mjs';
import { buildObject } from './object-builder.mjs';
// import default_user from '../defaults/user.mjs'

async function main() {
  if (!process.stdout.isTTY) {
    const db = process.env.DB || 'mysql';
    spawn('npx', ['vitest', 'run'], {
      stdio: 'inherit',
      env: { ...process.env, DB: db }
    });
    return;
  }

  let back = false;
  let db_select;

  do {
    db_select = await select();

    // Build object after DB selection
    const { result: user, previous } = await buildObject('User body');

    if (previous) {
      back = true; // go back to db selection
      continue;
    }

    back = false;

    // Run Vitest
    const child = spawn('npx', ['vitest', 'run'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DB: db_select.db,
        DB_FAMILY: db_select.family,
        USER_OBJ: JSON.stringify(user)
      }
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });

  } while (back);
}

main();