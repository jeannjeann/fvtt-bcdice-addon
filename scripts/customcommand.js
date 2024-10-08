import { getDataForCurrentEntity, roll } from "./dsn-utilities.js";

const replacementRegex = /\{\s*([^\}]+)\s*\}/g;

/**
 * Execute BCDice comannds.
 */
export async function customCommand(command, messageData, parameters) {
  let rollFormula = parameters || "";
  let orgFormula = parameters || "";

  if (rollFormula !== "") {
    const system =
      game.user.getFlag("fvtt-bcdice-addon", "sys-id") ??
      game.settings.get("fvtt-bcdice-addon", "game-system");
    const replacements = getReplacements();
    const set = new Set();
    while (rollFormula.match(replacementRegex)) {
      rollFormula = rollFormula.replaceAll(replacementRegex, (_, token) => {
        if (set.has(token)) return "";
        return replacements[token] ?? "";
      });
    }

    const results = await roll(system, rollFormula, orgFormula);
    const result = await getResult(system, results);
    return result;
  }
}

function getReplacements() {
  const out = {};
  [
    ...(getDataForCurrentEntity().replacements ?? "").matchAll(
      /^(?!\s*#)\s*(.+)\s*=\s*(.+)$/gim
    ),
  ]
    .reduce((all, [_, key, value]) => {
      all.set(key, value);
      return all;
    }, new Map())
    .forEach((value, key, map) => {
      const set = new Set();
      set.add(key);
      let val = value;

      while (val.match(replacementRegex)) {
        val = val.replace(replacementRegex, (_, string) => {
          if (set.has(string)) return "";
          return map.get(string.trim());
        });
      }
      out[key] = val;
    });
  return out;
}

// modify result
function getResult(system, results) {
  let result;
  switch (system) {
    case "Custom System Name":
      result = results.result;
      break;
    default:
      result = results.text;
      break;
  }
  return result;
}
