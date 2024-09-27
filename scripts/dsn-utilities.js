import { APIError } from "./errors.js";
import { getRoll } from "./remote-api.js";

const shiftCharCode = (Δ) => (c) => String.fromCharCode(c.charCodeAt(0) + Δ);
const toHalfWidth = (str) =>
  str.replace(/[！-～]/g, shiftCharCode(-0xfee0)).replace(/　/g, " ");

function getResultOutput() {
  return game.settings.get("fvtt-bcdice-addon", "result-output");
}
function getSuccessColor() {
  return game.settings.get("fvtt-bcdice-addon", "success-color") ?? "#2e6dff";
}
function getFailureColor() {
  return game.settings.get("fvtt-bcdice-addon", "failure-color") ?? "#ff0077";
}
function getNormalColor() {
  return game.settings.get("fvtt-bcdice-addon", "normal-color") ?? "#555555";
}
function isColor(color) {
  return color.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/) !== null;
}

function parseBCtoDSN(rands) {
  const validDice = [2, 4, 6, 8, 10, 12, 20, 100];

  const rolls = rands.reduce(
    (acc, el) => {
      if (!validDice.includes(el.sides)) {
        return acc;
      }

      if (el.sides === 100) {
        const tens = Math.floor(el.value / 10);
        const ones = el.value % 10;

        acc = appendDSNRoll(acc, tens, 100);
        return appendDSNRoll(acc, ones, 10);
      }

      return appendDSNRoll(acc, el.value, el.sides);
    },
    {
      throws: [{ dice: [] }],
    }
  );

  return rolls;
}

function appendDSNRoll(acc, value, sides) {
  acc.throws[0].dice.push({
    result: value,
    resultLabel: value,
    type: `d${sides}`,
    vectors: [],
    options: {},
  });
  return acc;
}

async function roll(system, formula) {
  const aliasText = `{${system}`;
  const entity = getCurrentDocument();
  const userMessageOptions = {
    speaker: {
      alias: `${entity.name}`,
    },
    content: `${formula}`,
  };

  // variable change command
  const chVar = formula.charAt(0) === ":";
  if (chVar) {
    const result = await changeReplacements(formula);

    let normalColor = getNormalColor();
    if (isColor(normalColor) === false) {
      normalColor = "#555555";
    }
    const message = `<div><i class="fas fa-dice"></i> 
                        ${formula}
                        <p class="success-normal" style="color: ${normalColor}">
                          ${result.key} : ${result.prev} > ${result.new}
                        </p>
                      </div>`;

    const messageOptions = {
      content: message,
      speaker: {
        // alias: `${system}`,
        alias: `${entity.name}`,
      },
    };

    if (getResultOutput()) {
      ChatMessage.create(messageOptions);
    }

    const chVarText = result.key;
    const chVarResult = result.new;
    return { text: chVarText, result: chVarResult };
  }

  /* error in commands starting with “s”
  const secret = formula.charAt(0).toLowerCase() === "s";
  if (secret) {
    userMessageOptions.type = 1;
    userMessageOptions.whisper = [user.id];
  }
  */

  // ChatMessage.create(userMessageOptions);
  try {
    const data = await getRoll(system, toHalfWidth(formula));

    let successColor = getSuccessColor();
    let failureColor = getFailureColor();
    let normalColor = getNormalColor();
    if (isColor(successColor) === false) {
      successColor = "#2667ff";
    }
    if (isColor(failureColor) === false) {
      failureColor = "#ff0077";
    }
    if (isColor(normalColor) === false) {
      normalColor = "#555555";
    }

    let results = undefined;
    if (data.success === true) {
      results = data.text
        .split("\n")
        .map(
          (el) =>
            `<p class="success-true" style="color: ${successColor}">${el}</p>`
        )
        .join("")
        .replace(/,/g, ",\u200B");
    } else if (data.failure === true) {
      results = data.text
        .split("\n")
        .map(
          (el) =>
            `<p class="success-false" style="color: ${failureColor}">${el}</p>`
        )
        .join("")
        .replace(/,/g, ",\u200B");
    } else {
      results = data.text
        .split("\n")
        .map(
          (el) =>
            `<p class="success-normal" style="color: ${normalColor}">${el}</p>`
        )
        .join("")
        .replace(/,/g, ",\u200B");
    }

    // const results = data.text
    //   .split("\n")
    //   .map((el) => `<p class="success-true">${el}</p>`)
    //   .join("")
    //   .replace(/,/g, ",\u200B");

    const message = `<div><i class="fas fa-dice"></i> 
                        ${formula} ${results}
                      </div>`;

    const messageOptions = {
      content: message,
      speaker: {
        // alias: `${system}`,
        alias: `${entity.name}`,
      },
    };
    if (data.secret) {
      messageOptions.type = 1;
      messageOptions.whisper = [game.user.id];
    }

    if (game.dice3d?.isEnabled()) {
      const rolls = parseBCtoDSN(data.rands);
      if (!rolls.throws[0].dice.length)
        messageOptions.sound = "sounds/dice.wav";
      await game.dice3d
        .show(rolls, game.user, !data.secret)
        .then((displayed) => {});
    } else {
      messageOptions.sound = "sounds/dice.wav";
    }

    if (getResultOutput()) {
      ChatMessage.create(messageOptions);
    }

    const text = data.text;
    const index = text.lastIndexOf("＞ ");
    const result = text.substring(index + 2);

    return { text, result };
  } catch (err) {
    if (err instanceof APIError) {
      const invalidFormulaText = game.i18n.localize(
        "fvtt-bcdice.invalidFormula"
      );
      if (getResultOutput()) {
        ChatMessage.create({
          content: `${formula}`,
          speaker: {
            alias: `${entity.name}`,
          },
        });
      }
    }
    //console.error(err);
    return { text: `${formula}`, result: null };
  }
}

/**
 *
 * @returns current entity document
 */
function getCurrentDocument() {
  if (
    canvas?.tokens?.controlled.length === 1 &&
    (game.user.isGM ||
      canvas.tokens.controlled[0].actor.permission ===
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
  ) {
    return canvas.tokens.controlled[0].document;
  }
  return game.user.character ?? game.user;
}

function getDataForCurrentEntity() {
  return duplicate(
    getCurrentDocument().getFlag("fvtt-bcdice-addon", "macro-data") ?? {
      tabs: [],
      importSettings: {},
      replacements: "",
    }
  );
}

// change variable function
async function changeReplacements(formula) {
  const token = getDataForCurrentEntity();
  const currentReplacements =
    "," + token.replacements.replace(/\n/g, ",") + ",";

  // command formatting
  let targetKey, newValue;
  const replaceFormula = formula.replace(/^:/, "");
  const calc = replaceFormula.match(/([+\-*/=])/);
  if (calc) {
    const calcIndex = calc.index;
    targetKey = replaceFormula.slice(0, calcIndex);
    newValue = replaceFormula.slice(calcIndex);
  } else {
    targetKey = replaceFormula;
    newValue = null;
  }

  // search replacement
  let prevReplacement, matchKey, prevValue;
  const searchReplacement = new RegExp(
    `(?:^|,)\\s*(${targetKey})\\s*=\\s*([^,]*)(?=,|$)`
  );
  const matchReplacement = currentReplacements.match(searchReplacement);
  if (matchReplacement) {
    prevReplacement = matchReplacement[0].replace(/^,/, "");
    matchKey = matchReplacement[1];
    prevValue = matchReplacement[2];
  } else {
    prevReplacement = null;
    matchKey = null;
    prevValue = null;
  }

  // calculate value
  let newReplacement, resultValue;
  if (targetKey == "") {
    return;
  } else if (!newValue) {
    if (!prevValue) {
      newReplacement = `${targetKey}=0`;
      resultValue = 0;
    } else {
      newReplacement = `${prevReplacement}`;
      resultValue = prevValue;
    }
  } else if (newValue.startsWith("=")) {
    resultValue = newValue.replace(/^=/, "");
    if (!isNaN(eval(resultValue))) resultValue = eval(resultValue);
    newReplacement = `${targetKey}=${resultValue}`;
  } else {
    if (!isNaN(Number(prevValue)) && !isNaN(Number(newValue))) {
      resultValue = Number(prevValue) + Number(newValue);
    } else {
      resultValue = prevValue + newValue;
      try {
        if (!isNaN(eval(resultValue))) resultValue = eval(resultValue);
      } catch (error) {}
    }
    newReplacement = `${targetKey}=${resultValue}`;
  }

  let newReplacements;
  if (matchKey) {
    newReplacements = currentReplacements.replace(
      new RegExp(
        `,\\s*(${prevReplacement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*`,
        "g"
      ),
      `,${newReplacement}`
    );
  } else newReplacements = `${currentReplacements}${newReplacement},`;

  // update replacements
  let replacements = newReplacements.replace(/^,|,$/g, "").replace(/,/g, "\n");
  const data = mergeObject(
    getDataForCurrentEntity(),
    expandObject({ replacements })
  );
  await getCurrentDocument().setFlag("fvtt-bcdice-addon", "macro-data", data);

  return { key: targetKey, prev: prevValue, new: resultValue };
}

export {
  parseBCtoDSN,
  appendDSNRoll,
  roll,
  getCurrentDocument,
  getDataForCurrentEntity,
};
