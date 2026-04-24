#!/usr/bin/env node

import { spawn } from 'child_process';
import { select } from './db-select.mjs';
import { buildObject } from './object-builder.mjs';
import { createConnection } from './db-connection.mjs';
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

    //Create db connection
    let db = await createConnection(db_select);

    // Build object after DB selection
    const { result: user, previous } = await buildObject('User body');

    if (previous) {
      back = true; // go back to db selection
      continue;
    }

    back = false;

    const isWin = process.platform === "win32";

    const env = {
      ...process.env,
      DB_FAMILY: db_select.family,
      DB_HOST:db.db_address,
      DB_USER:db.user_name,
      DB_PWD:db.password,
      DB_NAME:db.db_name,
      USER_OBJ: JSON.stringify(user)
    }

    //run vitest
    const child = isWin
      ? spawn("cmd.exe", ["/d", "/s", "/c", "npx", "vitest", "run"], {
          stdio: "inherit",
          env,
        })
      : spawn("npx", ["vitest", "run"], {
          stdio: "inherit",
          env,
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });

  } while (back);
}

main();