#!/usr/bin/env node

import { spawn } from 'child_process';
import { select } from './db-select.mjs';
import { buildObject } from './object-builder.mjs';
import { createConnection } from './db-connection.mjs';
import default_user from '../saved/user.mjs'
import default_structure from '../saved/structure.mjs'
import default_query from '../saved/query.mjs'
import user_role from '../saved/user_role.mjs'
import { navigate_object } from './object-navigator-editor.mjs';
import prompts from 'prompts';
import { save_to_file } from './save-to-file.mjs';

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

      const { result: structure, previous } = await navigate_object('Structure body', '../saved/structure.mjs', default_structure);
      if (previous) {
        back = true;
        continue;
      }

      const user_type = await prompts(
        {
          type: 'text',
          name: 'role',
          message: 'Select the user type:',
          initial: user_role
        },
        {
          onCancel: () => {
              console.log('\nCancelled');
              process.exit(1);
          }
        }
      )

      await save_to_file(user_type.role, '../saved/user_role.mjs')

      const { result: user, go_back_to_structure } = await buildObject('User body', '../saved/user.mjs', default_user);
      if (go_back_to_structure) {
        back = true;
        continue;
      }

      const { result: query, go_back_to_user } = await navigate_object('Query Body', '../saved/query.mjs', default_query);
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
          USER_ROLE: user_type.role,
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