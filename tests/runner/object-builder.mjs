import prompts from 'prompts';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build a dynamic JSON object using prompts.
 * Shows current object and allows adding attributes.
 * Handles Ctrl+C / cancellation gracefully.
 * Supports "Save as default" to a file.
 */
export async function buildObject(initialName = 'Object', defaultFilePath = null, default_value = {}) {
  let result = { ...default_value };
  let done = false;

  const onCancel = () => {
    console.log('\nCancelled by user');
    process.exit(1);
  };

  while (!done) {
    // Display current object
    console.clear();
    console.log(`Current ${initialName}:`);
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // Menu options
    const { action } = await prompts(
      {
        type: 'select',
        name: 'action',
        message: 'Choose action',
        choices: [
          { title: '➕ Add a new attribute', value: 'add' },
          { title: '✏️ Edit existing attribute', value: 'edit' },
          { title: '❌ Delete attribute', value: 'delete' },
          { title: '💾 Save as default', value: 'save-default' },
          { title: 'Next', value: 'next' },
          { title: 'Previous', value: 'previous' }
        ]
      },
      { onCancel }
    );

    if (!action) onCancel();

    if (action === 'add') {
      const { key } = await prompts({ type: 'text', name: 'key', message: 'Enter the key' }, { onCancel });
      if (!key) continue;
      const { value } = await prompts({ type: 'text', name: 'value', message: `Enter the value for "${key}"` }, { onCancel });
      result[key] = value;

    } else if (action === 'edit') {
      const { key } = await prompts({ type: 'text', name: 'key', message: 'Enter the key to edit' }, { onCancel });
      if (!key || !(key in result)) continue;
      const { value } = await prompts({ type: 'text', name: 'value', message: `Enter the new value for "${key}"` }, { onCancel });
      result[key] = value;

    } else if (action === 'delete') {
      const { key } = await prompts(
        {
          type: 'select',
          name: 'key',
          message: 'Select the key to delete',
          choices: [...Object.keys(result).map((k) => ({ title: k, value: k })), { title: 'Cancel', value: null }]
        },
        { onCancel }
      );
      if (!key || !(key in result)) continue;
      delete result[key];

    } else if (action === 'save-default') {
      if (!defaultFilePath) {
        console.log('No default file path provided.');
        continue;
      }
      const resolvedPath = path.resolve(__dirname, defaultFilePath);
      await fs.writeFile(resolvedPath, `export default ${JSON.stringify(result, null, 2)};`, 'utf-8');
      console.log(`Saved as default: ${resolvedPath}`);
      await new Promise((r) => setTimeout(r, 1000)); // pause to show message

    } else if (action === 'next') {
      done = true;

    } else if (action === 'previous') {
      return { result, previous: true };
    }
  }

  return { result, previous: false };
}