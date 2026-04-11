import prompts from "prompts";
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Interactive CLI JSON editor (objects + arrays)
 */
export async function navigate_object(initialName = "Object", file_path, default_value = {}) {
  let root = structuredClone(default_value);
  let current_path = [];

  const onCancel = () => {
    console.log("\nCancelled by user");
    process.exit(1);
  };

  const getCurrent = () =>
    current_path.reduce((acc, key) => acc[key], root);

  const parseValue = (val) => {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  };

  while (true) {
    const current = getCurrent();
    const isArr = Array.isArray(current);
    const keys = isArr ? [] : Object.keys(current);

    console.clear();
    console.log(`Editing ${initialName}`);
    console.log(`current_path: ${current_path.join(".") || "root"}\n`);

    console.log("Full structure:");
    console.dir(root, { depth: null, colors: true });
    console.log("");

    let choices = [];

    // ========================
    // ARRAY MODE
    // ========================
    if (isArr) {
      choices = [
        { title: "Next", value: { type: "done" } },
        ...current.map((item, i) => ({
          title: formatArrayItem(i, item),
          value: { type: "index", index: i },
        })),
        { title: "➕ Add item", value: { type: "add-item" } },
        ...(current.length
          ? [{ title: "❌ Delete item", value: { type: "delete-item" } }]
          : []),
        ...(current_path.length
          ? [{ title: "⬅ Previous", value: { type: "back" } }]
          : []),
        { title: "💾 Save as default ", value: { type: "save-default" } }
      ];
    }

    // ========================
    // OBJECT MODE
    // ========================
    else {
      choices = [
        { title: "Next", value: { type: "done" } },
        ...keys.map((k) => ({
          title: formatKey(k, current[k]),
          value: { type: "key", key: k },
        })),
        { title: "➕ Add key", value: { type: "add" } },
        ...(keys.length
          ? [{ title: "❌ Delete key", value: { type: "delete" } }]
          : []),
        ...(current_path.length
          ? [{ title: "⬅ Previous", value: { type: "back" } }]
          : []),
        { title: "💾 Save as default ", value: { type: "save-default" } }
      ];
    }

    const { action } = await prompts(
      {
        type: "select",
        name: "action",
        message: "Select",
        choices,
      },
      { onCancel }
    );

    if (!action) onCancel();

    // ========================
    // ARRAY HANDLING
    // ========================
    if (isArr) {
      if (action.type === "index") {
        const value = current[action.index];

        if (isObject(value) || Array.isArray(value)) {
          current_path.push(action.index);
        } else {
          const { newValue } = await prompts(
            {
              type: "text",
              name: "newValue",
              message: `Edit [${action.index}]`,
              initial: JSON.stringify(value),
            },
            { onCancel }
          );

          current[action.index] = parseValue(newValue);
        }
      }

      else if (action.type === "add-item") {
        const { value } = await prompts(
          {
            type: "text",
            name: "value",
            message: "New item (JSON supported)",
          },
          { onCancel }
        );

        current.push(parseValue(value));
      }

      else if (action.type === "delete-item") {
        const { index } = await prompts(
          {
            type: "select",
            name: "index",
            message: "Delete which item?",
            choices: [
                ...current.map((_, i) => ({
                    title: `[${i}]`,
                    value: i,
                })),
                { title: "Cancel", value: undefined }
            ],
          },
          { onCancel }
        );

        if (index !== undefined) {
          current.splice(index, 1);
        }
      }
    }

    // ========================
    // OBJECT HANDLING
    // ========================
    else {
      if (action.type === "key") {
        const value = current[action.key];

        if (isObject(value) || Array.isArray(value)) {
          current_path.push(action.key);
        } else {
          const { newValue } = await prompts(
            {
              type: "text",
              name: "newValue",
              message: `Edit "${action.key}"`,
              initial: JSON.stringify(value),
            },
            { onCancel }
          );

          current[action.key] = parseValue(newValue);
        }
      }

      else if (action.type === "add") {
        const { key } = await prompts(
          {
            type: "text",
            name: "key",
            message: "Key name",
          },
          { onCancel }
        );

        if (!key) continue;

        const { value } = await prompts(
          {
            type: "text",
            name: "value",
            message: "Value (JSON supported)",
          },
          { onCancel }
        );

        current[key] = parseValue(value);
      }

      else if (action.type === "delete") {
        const { key } = await prompts(
          {
            type: "select",
            name: "key",
            message: "Delete which key?",
            choices: [
                ...keys.map((k) => ({ title: k, value: k })),
                { title: "Cancel", value: null }
            ],
          },
          { onCancel }
        );

        if (!key) continue;

        delete current[key];
      }
    }

    // ========================
    // SHARED
    // ========================
    if (action.type === "back") {
      current_path.pop();
    }

    if (action.type === "done") {
      return { result: root, previous: false };
    }

    if (action.type === "save-default") {
        const resolvedPath = path.resolve(__dirname, file_path);
        //save to default file
        await fs.writeFile(resolvedPath, `export default ${JSON.stringify(root, null, 2)};`, 'utf-8')

        console.log(`Saved as default: ${resolvedPath}`);
        await new Promise((r) => setTimeout(r, 1000)); // pause to show message
    }
  }
}

// ------------------------
// Helpers
// ------------------------

function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatKey(key, value) {
  if (Array.isArray(value)) return `📚 ${key} (${value.length})`;
  if (isObject(value)) return `📂 ${key}`;
  return `📄 ${key}: ${JSON.stringify(value)}`;
}

function formatArrayItem(i, value) {
  if (Array.isArray(value)) return `📚 [${i}] (${value.length})`;
  if (isObject(value)) return `📂 [${i}]`;
  return `📄 [${i}]: ${JSON.stringify(value)}`;
}