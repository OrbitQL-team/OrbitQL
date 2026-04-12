#!/usr/bin/env node

import { spawn } from 'child_process';
import { select } from './db-select.mjs';
import { buildObject } from './object-builder.mjs';
import default_user from '../saved/user.mjs'
import default_structure from '../saved/structure.mjs'
import default_query from '../saved/query.mjs'
import { navigate_object } from './object-navigator-editor.mjs';
import prompts from 'prompts';

async function main() {
  let back = false;

  const test = await prompts(
    {
      type: 'select',
      name: 'type',
      message: 'Select the type of test:',
      choices: [
        { title: 'Auto running default tests', value: 'default' },
        { title: 'Custom test', value: 'custom' },
        { title: 'Exit', value: null }
      ]
    },
      {
      onCancel: () => {
          console.log('\nCancelled');
          process.exit(1);
      }
    }
  );
  if(test.type == 'default') {

  }else if(test.type == 'custom') {
    do {
      let db_select = await select();

      back = false;

      const { result: structure, previous } = await navigate_object('Structure body', '../defaults/structure.mjs', default_structure);
      if (previous) {
        back = true;
        continue;
      }

      const { result: user, go_back_to_structure } = await buildObject('User body', '../defaults/user.mjs', default_user);
      if (go_back_to_structure) {
        back = true;
        continue;
      }

      const { result: query, go_back_to_user } = await navigate_object('Query Body', '../defaults/query.mjs', default_query);
      if (go_back_to_user) {
        back = true;
        continue;
      }

      // Run Vitest
      const child = spawn('npx', ['vitest', 'run'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          DB: db_select.db,
          DB_FAMILY: db_select.family,
          USER_OBJ: JSON.stringify(user),
          STRUCTURE_OBJ: JSON.stringify(structure),
          STRUCTURE_QUERY: JSON.stringify(query),
        }
      });

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });

    } while (back);
  }
}

main();