#!/usr/bin/env node

import { spawn } from 'child_process';
import { select } from './db-select.mjs';
import { buildObject } from './object-builder.mjs';
import default_user from '../defaults/user.mjs'
import default_structure from '../defaults/structure.mjs'
import { navigate_object } from './object-navigator-editor.mjs';

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

    const { result: structure, previous } = await navigate_object('Structure body', '../defaults/structure.mjs', default_structure);
    if (previous) {
      back = true;
      continue;
    }

    back = false;

    const { result: user, previous_structure } = await buildObject('User body', '../defaults/user.mjs', default_user);
    if (previous_structure) {
      back = true;
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