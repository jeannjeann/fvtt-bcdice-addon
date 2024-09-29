import { showRoller, setupRoller } from "./bcroller.js";
import { getSystems } from "./remote-api.js";
import { getDataForCurrentEntity } from "./dsn-utilities.js";
import { customCommand } from "./customcommand.js";

let roller;
const command = "/bcd";

Hooks.once("init", async () => {
  registerSettings();

  const select2Style = document.createElement("link");
  const select2Script = document.createElement("script");

  select2Style.setAttribute(
    "href",
    "https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css"
  );
  select2Style.setAttribute("rel", "stylesheet");

  select2Script.setAttribute(
    "src",
    "https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"
  );

  document.head.appendChild(select2Style);
  document.head.appendChild(select2Script);

  roller = await setupRoller();
  registerKeybinds();

  game.modules.get("fvtt-bcdice-addon").api = {
    getDataForCurrentEntity,
    customCommand,
  };

  // Custom chat command for Chat Commander
  let customCommandModule = "_chatcommands";
  let chatcommands =
    game.modules.has(customCommandModule) &&
    game.modules.get(customCommandModule).active;
  if (chatcommands) {
    game.chatCommands.register({
      name: "/bcd",
      aliases: ["/bcdice"],
      module: "_chatcommands",
      description: "BCDice command.",
      icon: "<i class='fas fa-dice'></i>",
      callback: async (chat, parameters, messageData) => {
        await customCommand(command, messageData, parameters);
        return;
      },
      autocompleteCallback: (menu, alias, parameters) => {
        const token = getDataForCurrentEntity();
        const macro = [];
        for (let i = 0; i < token.tabs.length; i++) {
          for (let j = 0; j < token.tabs[i].headers.length; j++) {
            for (let k = 0; k < token.tabs[i].headers[j].macros.length; k++) {
              macro.push(token.tabs[i].headers[j].macros[k].macro);
            }
          }
        }
        const replacements = token.replacements
          .split("\n")
          .map((line) => `:${line}`);
        const totalcandidate = [...macro, ...replacements];
        const candidate = totalcandidate.filter((line) =>
          line.toLowerCase().includes(parameters.toLowerCase())
        );
        const entries = [];
        for (let i = 0; i < candidate.length; i++) {
          entries.push(
            game.chatCommands.createCommandElement(
              `${alias} ${candidate[i]}`,
              candidate[i]
            )
          );
        }
        entries.length = Math.min(entries.length, menu.maxEntries);
        return entries;
      },
    });
  }

  // Inline roll parse
  CONFIG.TextEditor.enrichers.push({
    pattern: /\[\[\/bcd .*?]]/gi,
    enricher: inlineRollButton,
  });
  // activate listeners
  $("body").on("click", "a.bcd-inline-roll", onClickInlineRollButton);
});

// Custom chat command
Hooks.on("chatMessage", (chat, parameters, messageData) => {
  if (parameters !== undefined && parameters.startsWith(command)) {
    customCommand(command, messageData, parameters.slice(5));
    return false;
  } else {
    return true;
  }
});

Hooks.on("renderSceneControls", async function () {
  if (!$("#bc-dice-control").length) {
    $("#controls > .main-controls").append(
      '<li class="scene-control" id="bc-dice-control" title="BC Dice [Shift] + [Ctrl] + [B]"><i class="fas fa-dice"></i></li>'
    );
    $("#bc-dice-control").click(() => {
      showRoller(roller);
    });
  }
});

async function registerKeybinds() {
  game.keybindings.register("fvtt-bcdice-addon", "open", {
    name: game.i18n.localize("fvtt-bcdice.keybindName"),
    hint: game.i18n.localize("fvtt-bcdice.keybindHint"),
    editable: [
      {
        key: "KeyB",
        modifiers: ["Control", "Shift"],
      },
    ],
    onDown: () => {
      showRoller(roller);
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
}

/**
 * Text enricher that creates a deferred inline roll button.
 * @param {RegExpMatchArray} match the pattern match for this enricher
 * @param {EnrichmentOptions} _options the options passed to the enrich function
 * @returns {HTMLAnchorElement} the deferred inline roll button
 */
const inlineRollButton = (match, _options) => {
  const literal = match[0].slice(7, -2);
  const a = document.createElement("a");
  a.classList.add("bcd-inline-roll");
  a.dataset.messageData = literal;
  a.dataset.parameters = literal.replace(command, "");
  a.innerHTML = `<i class="fas fa-dice"></i>${literal}`;
  return a;
};

/**
 * @param {Event} event the browser event that triggered this listener
 */
const onClickInlineRollButton = (event) => {
  event.preventDefault();
  const a = event.currentTarget;
  const messageId = a.closest(".message")?.dataset.messageId;
  const messageData = game.messages.get(messageId);
  const parameters = a.dataset.parameters;

  return customCommand(command, messageData, parameters);
};

async function registerSettings() {
  game.settings.register("fvtt-bcdice-addon", "roller-persistance", {
    name: game.i18n.localize("fvtt-bcdice.persistanceSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.persistanceSettingHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("fvtt-bcdice-addon", "formula-persistance", {
    name: game.i18n.localize("fvtt-bcdice.formulaPersistanceSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.formulaPersistanceSettingHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register("fvtt-bcdice-addon", "result-output", {
    name: game.i18n.localize("fvtt-bcdice.resultOutputSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.resultOutputSettingHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("fvtt-bcdice-addon", "bc-server", {
    name: game.i18n.localize("fvtt-bcdice.serverSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.serverSettingHint"),
    scope: "world",
    config: true,
    type: String,
    default: "https://bcdice.onlinesession.app/v2",
  });

  game.settings.register("fvtt-bcdice-addon", "normal-color", {
    name: game.i18n.localize("fvtt-bcdice.NormalColorSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.NormalColorSettingSettingHint"),
    scope: "world",
    config: true,
    type: String,
    default: "#555555",
  });

  game.settings.register("fvtt-bcdice-addon", "success-color", {
    name: game.i18n.localize("fvtt-bcdice.SuccessColorSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.SuccessColorSettingSettingHint"),
    scope: "world",
    config: true,
    type: String,
    default: "#2e6dff",
  });

  game.settings.register("fvtt-bcdice-addon", "failure-color", {
    name: game.i18n.localize("fvtt-bcdice.FailureColorSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.FailureColorSettingHint"),
    scope: "world",
    config: true,
    type: String,
    default: "#ff0077",
  });

  const data = await getSystems();

  const systems = data.reduce((acc, el) => {
    acc[el.id] = el.name;
    return acc;
  }, {});

  game.settings.register("fvtt-bcdice-addon", "game-system", {
    name: game.i18n.localize("fvtt-bcdice.systemSettingName"),
    hint: game.i18n.localize("fvtt-bcdice.systemSettingHint"),
    scope: "world",
    config: true,
    type: String,
    choices: systems,
    default: data[0].id,
  });
}
