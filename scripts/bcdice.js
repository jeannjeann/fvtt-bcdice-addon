import { showRoller, setupRoller } from "./bcroller.js";
import { getSystems } from "./remote-api.js";
import { getDataForCurrentEntity } from "./dsn-utilities.js";
import { customCommand } from "./customcommand.js";
import { toBCD } from "./syncvariable.js";

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

// Add scene control button
Hooks.on("renderSceneControls", async function () {
  const bcdice_btn = $(`
    <li>
      <button type="button" class="control ui-control layer icon fa-solid fa-dice" 
        role="tab" data-action="control" data-control="bcdice" data-tooltip 
        aria-pressed="false" aria-label="BC Dice [Shift] + [Ctrl] + [Alt] + [B]" 
        aria-controls="scene-controls-tools" id="scene-controls-layers">
      </button>
    </li>
  `);

  bcdice_btn.find("button").on("click", function () {
    $(this).attr("aria-pressed", "true");
    showRoller(roller);
  });

  const scene_controls_leyers = document.getElementById("scene-controls-layers");
  if (scene_controls_leyers) {
    if (!document.getElementById("bc-dice-control")) {
      $(scene_controls_leyers).append(bcdice_btn);
    }
  }
});

// Add ActorSheet button
Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
  buttons.unshift({
    icon: "fas fa-dice",
    class: "open-bcdice",
    label: "BCDice",
    onclick: function openBCDice(event) {
      const actor = app.object;
      if (!app.token) {
        ActorDialog.setActor(actor);
      }
      showRoller(roller);
    },
  });
});

// Actor update hook
Hooks.on("updateActor", async (actor, updateData, options, userId) => {
  // CSB cooperation
  let csbcoop = game.settings.get("fvtt-bcdice-addon", "csb-cooperation");
  if (csbcoop) {
    const actorid = actor._id;
    const data = updateData?.system?.props;
    if (data) {
      toBCD(actorid, data);
    }
  }

  // Sync to Token
  const bcdiceFlags = actor.flags["fvtt-bcdice-addon"];
  const tokens = canvas.tokens.placeables.filter(
    (token) => token.actor?.id === actor.id && token.document.actorLink
  );
  for (const token of tokens) {
    await token.document.update({ [`flags.fvtt-bcdice-addon`]: bcdiceFlags });
  }
});

// Token create hook
Hooks.on("createToken", async (tokenDocument, options, userId) => {
  // add macro to Token
  const actor = tokenDocument.actor;
  if (!actor) return;
  const bcdiceFlags = actor.flags["fvtt-bcdice-addon"];
  await tokenDocument.update({
    [`flags.fvtt-bcdice-addon`]: bcdiceFlags,
  });
});

// Token update hook
Hooks.on("updateToken", async (tokenDocument, updateData, options, userId) => {
  // Sync to Actor
  const actor = tokenDocument.actor;
  const actorLink = tokenDocument.actorLink;
  if (!actor || !actorLink) return;
  const bcdiceFlags = updateData.flags["fvtt-bcdice-addon"];
  await actor.update({
    [`flags.fvtt-bcdice-addon`]: bcdiceFlags,
  });
});

async function registerKeybinds() {
  game.keybindings.register("fvtt-bcdice-addon", "open", {
    name: game.i18n.localize("fvtt-bcdice.keybindName"),
    hint: game.i18n.localize("fvtt-bcdice.keybindHint"),
    editable: [
      {
        key: "KeyB",
        modifiers: ["Control", "Shift", "Alt"],
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
  game.settings.registerMenu("fvtt-bcdice-addon", "syncsettings", {
    name: game.i18n.localize("fvtt-bcdice.syncSettingsName"),
    hint: game.i18n.localize("fvtt-bcdice.syncSettingshint"),
    label: game.i18n.localize("fvtt-bcdice.syncSettingsLabel"),
    icon: "fas fa-cog",
    scope: "world",
    type: syncSettings,
    restricted: true,
  });

  game.settings.register("fvtt-bcdice-addon", "syncValue", {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

  game.settings.register("fvtt-bcdice-addon", "csb-cooperation", {
    name: game.i18n.localize("fvtt-bcdice.csbCooperationName"),
    hint: game.i18n.localize("fvtt-bcdice.csbCooperationHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

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

// Sync Setting Dialog
class syncSettings extends FormApplication {
  constructor(object = {}, options = {}) {
    super(object, options);
    this.sync = "";
  }
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("fvtt-bcdice.syncSettings"),
      id: "syncsettings",
      template: "modules/fvtt-bcdice-addon/templates/sync.html",
      width: 500,
      height: 400,
      resizable: true,
      closeOnSubmit: true,
    });
  }

  async getData() {
    this.sync =
      (await game.settings.get("fvtt-bcdice-addon", "syncValue")) || "";
    return {
      sync: this.sync,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[data-button="save"]').click(async (ev) => {
      const syncValue = html.find('textarea[name="sync"]').val();
      this.sync = syncValue;
      await game.settings.set("fvtt-bcdice-addon", "syncValue", this.sync);
      this.close();
    });
  }
}

// Actor dialog flag
export class ActorDialog {
  static isActor = null;
  static setActor(actor) {
    ActorDialog.isActor = actor;
  }
  static getActor() {
    return ActorDialog.isActor;
  }
}
