import prompts from 'prompts';

/**
 * Build a dynamic JSON object using prompts.
 * Shows current object and allows adding attributes.
 * Handles Ctrl+C / cancellation gracefully.
 */
export async function buildObject(initialName = 'Object', result = {}) {
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
          { title: 'Add a new attribute', value: 'add' },
          { title: 'Next', value: 'next' },
          { title: 'Previous', value: 'previous' }
        ]
      },
      { onCancel }
    );

    if (!action) {
      onCancel();
    }

    if (action === 'add') {
      // Ask for key
      const { key } = await prompts(
        {
          type: 'text',
          name: 'key',
          message: 'Enter the key'
        },
        { onCancel }
      );

      if (!key) continue;

      // Ask for value
      const { value } = await prompts(
        {
          type: 'text',
          name: 'value',
          message: `Enter the value for "${key}"`
        },
        { onCancel }
      );

      result[key] = value;
    } else if (action === 'next') {
      done = true;
    } else if (action === 'previous') {
      return { result, previous: true };
    }
  }

  return { result, previous: false };
}