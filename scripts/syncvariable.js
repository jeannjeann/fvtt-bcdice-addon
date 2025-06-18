import {
  getCurrentDocument,
  getDataForCurrentEntity,
} from "./dsn-utilities.js";

const replacementRegex = /\{\s*([^\}]+)\s*\}/g;

/**
 * Execute Sync variable CSB to BCD.
 */
export async function toBCD(actorid, data) {
  const syncSettings = getSyncSettings();
  const bcd = Object.entries(getReplacements()).map(([key, value], index) => ({
    key: key,
    value: value,
  }));
  const csb = Object.entries(data).map(([key, value], index) => ({
    key: key,
    value: value,
  }));
  let key, value;
  let newReplacement = [];
  for (let i = 0; i < csb.length; i++) {
    for (let j = 0; j < syncSettings.length; j++) {
      let dtflag = typeof csb[i].value === "object" && csb[i].value !== null;
      if (!dtflag) {
        if (csb[i].key == syncSettings[j].csb) {
          key = syncSettings[j].bcd;
          value = csb[i].value;
          newReplacement.push(`${key}=${value}`);
        }
      } else if (syncSettings[j].csb.includes(",")) {
        const csbkey = syncSettings[j].csb
          .split(",")
          .map((item) => item.trim());
        const token = canvas.tokens.controlled[0];
        const dtkey = token.actor.system.props[csb[i].key];
        for (let k = 0; k < Object.keys(dtkey).length; k++) {
          if (csb[i].key == csbkey[0]) {
            if (dtkey[k][csbkey[1]] == syncSettings[j].bcd) {
              key = syncSettings[j].bcd;
              value = dtkey[k][csbkey[2]];
              newReplacement.push(`${key}=${value}`);
            }
          }
        }
      }
    }
  }
  let prevKey, prevValue;
  let prevReplacement = [];
  for (let i = 0; i < newReplacement.length; i++) {
    let matchkey = newReplacement[i].split("=")[0];
    for (let j = 0; j < bcd.length; j++) {
      if (bcd[j].key == matchkey) {
        prevKey = bcd[j].key;
        prevValue = bcd[j].value;
        prevReplacement[i] = `${prevKey}=${prevValue}`;
      }
    }
  }
  // update replacements
  if (prevReplacement && newReplacement) {
    let replacements = getDataForCurrentEntity().replacements;
    for (let i = 0; i < newReplacement.length; i++) {
      if (!prevReplacement[i]) {
        console.warn(`No key: ${newReplacement[i]} (${actorid})`);
      } else {
        replacements = replacements.replace(
          prevReplacement[i],
          newReplacement[i]
        );
      }
    }
    const data = foundry.utils.mergeObject(
      getDataForCurrentEntity(),
      foundry.utils.expandObject({ replacements })
    );
    await getCurrentDocument().setFlag("fvtt-bcdice-addon", "macro-data", data);
  }
}

/**
 * Execute Sync variable BCD to CSB.
 */
export async function toCSB(actorid, data) {
  const syncSettings = getSyncSettings();
  let key, value, dtflag;
  for (let i = 0; i < syncSettings.length; i++) {
    if (syncSettings[i].bcd == data.key) {
      if (!syncSettings[i].csb.includes(",")) {
        dtflag = false;
        key = syncSettings[i].csb;
      } else {
        dtflag = true;
        key = syncSettings[i].csb.split(",").map((item) => item.trim());
      }
      value = data.new;
    }
  }
  // update variables
  const token = canvas.tokens.controlled[0];
  if (!dtflag && key) {
    if (!token.actor.system.props[key]) {
      console.warn(`No key: ${key} (${actorid})`);
    } else {
      token.actor.update({
        [`system.props.${key}`]: value,
      });
    }
  }
  if (dtflag && key) {
    let exist = false;
    const props = token.actor.system.props[key[0]];
    if (props) {
      for (let i = 0; i < Object.keys(props).length; i++) {
        if (props[i][key[1]] == data.key) {
          token.actor.update({
            [`system.props.${key[0]}.${i}.${key[2]}`]: value,
          });
          exist = true;
        }
      }
      if (!exist) console.warn(`No key: ${key[1]} (${actorid})`);
    } else console.warn(`No key: ${key[0]} (${actorid})`);
  }
}

// Get replacements function
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

// Get Sync Settings function
function getSyncSettings() {
  const syncValue = game.settings.get("fvtt-bcdice-addon", "syncValue") ?? "";
  const syncLines = syncValue.trim().split("\n");
  const syncSettings = syncLines
    .map((line) => {
      const syncLine = line.trim();
      if (syncLine.includes(":")) {
        const [bcd, csb] = syncLine.split(":").map((part) => part.trim());
        return { bcd, csb };
      }
    })
    .filter(Boolean);
  return syncSettings;
}
