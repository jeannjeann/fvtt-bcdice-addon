import {
  getCurrentDocument,
  getDataForCurrentEntity,
  roll,
} from "./dsn-utilities.js";
import MacroParser from "./macro-parser.js";
import { getHelpText, getSystems } from "./remote-api.js";
import { ActorDialog } from "./bcdice.js";

const replacementRegex = /\{\s*([^\}]+)\s*\}/g;

export default class BCDialog extends FormApplication {
  constructor() {
    super({});
    this.dialog = null;
  }

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      width: 400,
      height: "auto",
      resizable: true,
      closeOnSubmit: false,
      submitOnClose: true,
      submitOnChange: true,
      scrollY: ["div.bcdice-macro-page"],
      title: "BCDice Roller",
      template: "modules/fvtt-bcdice-addon/templates/dialog.html",
      tabs: [
        {
          navSelector: ".bcdice-tabs",
          contentSelector: ".bcdice-macro-page",
          initial: "macro-0",
        },
      ],
      id: "BCDialog",
    };
  }

  async close(options = {}) {
    ActorDialog.setActor(false);
    return super.close(options);
  }

  _getHeaderButtons() {
    /** @type {Array} */
    const buttons = super._getHeaderButtons();
    buttons.unshift({
      label: game.i18n.localize("fvtt-bcdice.replacements"),
      class: "replacements",
      icon: "fas fa-superscript",
      onclick: () => this.openReplacements(),
    });
    buttons.unshift({
      label: game.i18n.localize("fvtt-bcdice.edit"),
      class: "edit",
      icon: "fas fa-cogs",
      onclick: () => {
        this.submit();
        this.options.isEditable = !this.options.isEditable;
        this.render();
      },
    });
    buttons.unshift({
      label: game.i18n.localize("fvtt-bcdice.import"),
      class: "import",
      icon: "fas fa-file-import",
      onclick: () => this.openImporter(),
    });
    return buttons;
  }

  async getData() {
    await Promise.race([
      new Promise((resolve) => {
        Hooks.once("controlToken", resolve);
      }),
      new Promise((resolve) => {
        setTimeout(resolve, 100);
      }),
    ]);
    const macros = await getDataForCurrentEntity();
    const entity = await getCurrentDocument();
    return {
      editing: this.options.isEditable ?? false,
      systems: await getSystems(),
      data: macros,
      type: entity.constructor.documentName,
      entity: entity,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const system =
      game.users.get(game.userId).getFlag("fvtt-bcdice-addon", "sys-id") ??
      game.settings.get("fvtt-bcdice-addon", "game-system");
    html.find("#bc-system-help").click(this.getSysHelp.bind(this));
    html.find("#bc-systems").val(system);
    html.find("#bc-formula").focus();
    html.find(".s2").select2();
    html.find(".s2").on("select2:select", async (e) => {
      await game.users
        .get(game.userId)
        .setFlag("fvtt-bcdice-addon", "sys-id", `${e.params.data.id}`);
      this.render(false);
    });
    html.find("#bc-formula").on("keydown", this._onKeyDown.bind(this));
    // html
    //   .find("button.bcd-macro-button")
    //   .each((i, e) => e.addEventListener("click", this._macroClick.bind(this)));
    html.find("button[data-button=roll]").click(this._onRollButton.bind(this));
    html.find("[data-header] > h3").click(this._headerClick.bind(this));
    html.find("button[data-delete-tab]").click(this._deleteTab.bind(this));
    html
      .find("button[data-delete-header]")
      .click(this._deleteHeader.bind(this));
    html.find("a[data-delete-macro]").click(this._deleteMacro.bind(this));
    html.find("button.bcd-macro-button").click(this._macroClick.bind(this));
    html
      .find("button.bcd-macro-button")
      .contextmenu(this._rightClick.bind(this));
    html.find("a.add-tab").click(this._addTab.bind(this));
    html.find("button.bc-add-header").click(this._addHeader.bind(this));
    html.find("button[data-add-macro]").click(this._addMacro.bind(this));
  }

  _rightClick(event) {
    /**@type {HTMLButtonElement} */
    const button = event.target;
    const macro = this._getMacroFrom(button.dataset.macro);
    this.element.find("#bc-formula").val(macro);
  }

  _macroClick(event) {
    const button = event.target;
    const macro = this._getMacroFrom(button.dataset.macro);
    this.roll(macro);
  }

  async roll(macro) {
    let replacedMacro = macro;
    let orgMacro = macro;
    const replacements = this.replacements;
    const set = new Set();
    while (replacedMacro.match(replacementRegex)) {
      replacedMacro = replacedMacro.replaceAll(replacementRegex, (_, token) => {
        if (set.has(token)) return "";
        return replacements[token] ?? "";
      });
    }
    const results = await roll(this.getSystem(), replacedMacro, orgMacro);
  }

  async getSysHelp() {
    const aliasText = game.i18n.localize("fvtt-bcdice.alias");
    const data = await getHelpText(this.getSystem());
    const defaultData = await getHelpText("DiceBot");

    const helpMessageCustom = data.help_message
      .trim()
      .split("\n")
      .reduce(
        (acc, el) => {
          acc.push(`<p>${el}</p>`);
          return acc;
        },
        [`<h3>Game System Comands</h3>`]
      )
      .join("\n");
    const helpMessageDefault = defaultData.help_message
      .trim()
      .split("\n")
      .reduce(
        (acc, el) => {
          acc.push(`<p>${el}</p>`);
          return acc;
        },
        [`\n<p></p>\n<h3>Common Comands</h3>`]
      )
      .join("\n")
      .replace(
        `https://docs.bcdice.org/`,
        `<a href="https://docs.bcdice.org/">https://docs.bcdice.org/</a>`
      );
    const helpMessage = helpMessageCustom + helpMessageDefault;

    /* 
    ChatMessage.create({
      content: `<p><em>${this.getSystem()}</em></p>
              <p>${helpMessage}</p>`,
      speaker: {
        alias: aliasText,
      },
    });
    */

    new Dialog(
      {
        title: `BCDice Help (${this.getSystem()})`,
        content: `<h1><em>${data.name}</em></h1><p>${helpMessage}</p>`,
        buttons: {},
        default: "",
      },
      {
        width: 700,
        height: 600,
        resizable: true,
      }
    ).render(true);
  }

  _addTab() {
    const tabs = getDataForCurrentEntity().tabs;
    tabs.push({ name: game.i18n.localize("fvtt-bcdice.newTab"), headers: [] });
    this._updateObject(null, { tabs });
  }

  _addHeader(event) {
    const target = event.target.dataset.tab;
    const tabs = getDataForCurrentEntity().tabs;
    const tab = tabs[parseInt(target)];
    // if (!tab.headers) tab.headers = [];
    tab.headers.push({
      name: game.i18n.localize("fvtt-bcdice.newHeader"),
      macros: [],
      open: true,
    });
    this._updateObject(null, { tabs });
  }

  _addMacro(event) {
    const tabs = getDataForCurrentEntity().tabs;
    const target = event.target.dataset.addMacro;
    const [tabID, headerID] = target.split("-");
    tabs[+tabID].headers[+headerID].macros.push({
      display: game.i18n.localize("fvtt-bcdice.newMacro"),
      macro: "1D20",
    });
    this._updateObject(null, { tabs });
  }

  /**
   * @param {String} id
   * @returns {String}
   */
  _getMacroFrom(id) {
    const [tab, header, macro] = id.split("-").map((i) => parseInt(i));
    return getDataForCurrentEntity().tabs[tab].headers[header].macros[macro]
      .macro;
  }

  _onRollButton(ev) {
    const rollFormula = this.form.querySelector("#bc-formula").value;
    if (rollFormula !== "") {
      this.roll(rollFormula);
    }
    const shouldPersistInput = game.settings.get(
      "fvtt-bcdice-addon",
      "formula-persistance"
    );
    if (!shouldPersistInput) {
      this.form.querySelector("#bc-formula").value = "";
    }

    const shouldPersistRoller = game.settings.get(
      "fvtt-bcdice-addon",
      "roller-persistance"
    );
    if (ev.shiftKey || !shouldPersistRoller) {
      this.close();
    }
  }

  async _deleteTab(event) {
    const target = event.target.dataset.deleteTab;
    const tabs = getDataForCurrentEntity().tabs;
    if (
      !(await Dialog.confirm({
        title: game.i18n.localize("fvtt-bcdice.deleteThisTab"),
        content: game.i18n.localize("fvtt-bcdice.deleteTabBody"),
      }))
    )
      return;
    tabs.splice(+target, 1);
    this._updateObject(null, { tabs });
  }

  async _deleteHeader(event) {
    const target = event.target.dataset.deleteHeader;
    const tabs = getDataForCurrentEntity().tabs;
    if (
      !(await Dialog.confirm({
        title: game.i18n.localize("fvtt-bcdice.deleteThisHeader"),
        content: game.i18n.localize("fvtt-bcdice.deleteHeaderBody"),
      }))
    )
      return;
    const [tabID, headerID] = target.split("-");
    tabs[+tabID].headers.splice(+headerID, 1);
    this._updateObject(null, { tabs });
  }

  async _deleteMacro(event) {
    const target = event.currentTarget.dataset.deleteMacro;
    const tabs = getDataForCurrentEntity().tabs;
    const [tabID, headerID, macroID] = target.split("-");
    tabs[+tabID].headers[+headerID].macros.splice(+macroID, 1);
    this._updateObject(null, { tabs });
  }

  async _headerClick(event) {
    const targetHeader = event.currentTarget.parentElement.dataset.header;
    const tabs = getDataForCurrentEntity().tabs;
    const [tabIndex, headerIndex] = targetHeader
      .split("-")
      .map((i) => parseInt(i));
    const header = tabs[tabIndex].headers[headerIndex];
    header.open = !header.open;
    await this._updateObject(null, { tabs });
  }

  getSystem() {
    return (
      game.user.getFlag("fvtt-bcdice-addon", "sys-id") ??
      game.settings.get("fvtt-bcdice-addon", "game-system")
    );
  }

  get replacements() {
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

  async openImporter() {
    const defaultImportSettings = {
      headers: {
        start: "■",
        end: "=",
      },
      macro: {
        order: "left",
        splitter: "",
      },
      replacements: {
        varDef: "//",
        left: "{",
        right: "}",
      },
    };
    if (
      this.dialog &&
      this.dialog._state === Application.RENDER_STATES.RENDERED &&
      this.dialog.data.type === "importer"
    ) {
      this.dialog.bringToTop();
      return;
    }
    this.dialog?.close();

    const dialogContent = await renderTemplate(
      "modules/fvtt-bcdice-addon/templates/import.html",
      {
        settings: mergeObject(
          defaultImportSettings,
          getDataForCurrentEntity().settings
        ),
      }
    );
    this.dialog = new Dialog({
      title: game.i18n.localize("fvtt-bcdice.bcdiceImporter"),
      content: dialogContent,
      type: "importer",
      buttons: {
        ok: {
          icon: '<i class="fas fa-file-import"></i>',
          label: game.i18n.localize("fvtt-bcdice.import"),
          callback: async (html) => {
            const tabName = html.find("input[name=tab-name]").val();
            const macroText = html.find("textarea").val();
            const splitReplacements = html
              .find("#splitReplacements")
              .is(":checked");

            // edit macro text
            let importText, variables;
            if (splitReplacements == true) {
              const macroLines = macroText.split("\n");
              importText = macroLines
                .filter((line) => !line.trim().startsWith("//"))
                .join("\n");
              variables = macroLines
                .filter((line) => line.trim().startsWith("//"))
                .map((line) => line.replace(/^\/\/\s*/, ""))
                .join("\n");
              const replacements = variables;
              await this._updateObject(null, { replacements });
            } else {
              importText = macroText;
            }

            const settings = {
              headers: {
                start: html.find("input[name=header-marker]").val(),
                end: html.find("input[name=header-trim]").val(),
              },
              macro: {
                order: html.find("select[name=order]").val(),
                splitter: html.find("input[name=macro-splitter]").val(),
              },
              replacements: {
                varDef: html.find("input[name=variable-marker]").val(),
                left: html.find("input[name=replacement-left]").val(),
                right: html.find("input[name=replacement-right]").val(),
              },
            };
            const parser = new MacroParser(settings);

            const parsed = parser.process(tabName, importText);
            const tabs = getDataForCurrentEntity().tabs;
            tabs.push(parsed);
            await this._updateObject(null, { tabs });
            this.dialog = null;
          },
        },
      },
      //default: "ok",
    });
    this.dialog.render(true);
  }

  async openReplacements() {
    if (
      this.dialog &&
      this.dialog._state === Application.RENDER_STATES.RENDERED &&
      this.dialog.data.type === "replacements"
    ) {
      this.dialog.bringToTop();
      return;
    }
    this.dialog?.close();

    const dialogContent = await renderTemplate(
      "modules/fvtt-bcdice-addon/templates/replacements.html",
      { replacements: getDataForCurrentEntity().replacements }
    );

    this.dialog = new Dialog(
      {
        title: game.i18n.localize("fvtt-bcdice.bcdiceReplacements"),
        content: dialogContent,
        type: "replacements",
        buttons: {
          ok: {
            icon: '<i class="fas fa-save"></i>',
            label: game.i18n.localize("fvtt-bcdice.save"),
            callback: async (html) => {
              const replacements = html
                .find("textarea[name=replacements]")
                .val();
              await this._updateObject(null, { replacements });
              this.dialog = null;
            },
          },
        },
        render: (html) => {
          const dialog = html.closest(".dialog");
          dialog.css({
            display: "flex",
            flexDirection: "column",
            height: "100%",
          });
          const content = dialog.find(".dialog-content");
          content.css({
            flexGrow: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          });
          const textarea = html.find("textarea[name=replacements]");
          textarea.css({ flexGrow: 1, height: "100%", overflow: "auto" });
          const buttons = dialog.find(".dialog-buttons");
          buttons.css({
            flexGrow: 0,
            padding: "10px 0 0 0",
            display: "flex",
            justifyContent: "flex-end",
          });
        },
      },
      { width: 500, height: 360, resizable: true }
    );
    this.dialog.render(true);
  }

  async _updateObject(_event, formData) {
    Object.entries(formData).forEach(([k, v]) => {
      if (!k.startsWith("tabs.")) return;
      if (!formData.tabs) formData.tabs = getDataForCurrentEntity().tabs;
      delete formData[k];
      const matcher = /([^\.]+)(?:\.(.+))?/g;
      const keys = [...k.matchAll(/([^\.]+)/g)].map(([v]) => v);
      let target = formData;
      let key;
      while (keys.length > 0) {
        key = keys.shift();
        if (target instanceof Array) key = parseInt(key);
        if (target[key] instanceof Object) target = target[key];
      }
      target[key] = v;
    });
    const tabs = formData.tabs || getDataForCurrentEntity().tabs;
    const data = mergeObject(getDataForCurrentEntity(), expandObject(formData));
    data.tabs = tabs;
    await getCurrentDocument().setFlag("fvtt-bcdice-addon", "macro-data", data);
    this._render();
  }

  _onKeyDown(event) {
    // Close dialog
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      return this.close();
    }
    // Confirm default choice
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      this._onRollButton(event);
    }
  }
}
