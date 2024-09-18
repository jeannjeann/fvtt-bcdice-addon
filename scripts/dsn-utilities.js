import { APIError } from "./errors.js";
import { getRoll } from "./remote-api.js";

const shiftCharCode = (Δ) => (c) => String.fromCharCode(c.charCodeAt(0) + Δ);
const toHalfWidth = (str) =>
  str.replace(/[！-～]/g, shiftCharCode(-0xfee0)).replace(/　/g, " ");

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
  const secret = formula.charAt(0).toLowerCase() === "s";
  if (secret) {
    userMessageOptions.type = 1;
    userMessageOptions.whisper = [user.id];
  }

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
      messageOptions.whisper = [user.id];
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

    ChatMessage.create(messageOptions);

    const text = data.text;
    const index = text.lastIndexOf("＞ ");
    const result = text.substring(index + 2);

    return { text, result };
  } catch (err) {
    if (err instanceof APIError) {
      const invalidFormulaText = game.i18n.localize(
        "fvtt-bcdice.invalidFormula"
      );
      ChatMessage.create({
        content: `${formula}`,
        speaker: {
          alias: `${entity.name}`,
        },
      });
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

export {
  parseBCtoDSN,
  appendDSNRoll,
  roll,
  getCurrentDocument,
  getDataForCurrentEntity,
};
