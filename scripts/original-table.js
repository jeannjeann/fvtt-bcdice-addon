export default class OriginalTableApplication extends FormApplication {
  constructor(options = {}) {
    super(options);
    this.activeId = null;
    this._initialized = false;
  }

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      title: game.i18n.localize("fvtt-bcdice.originalTable.menuName"),
      id: "bcdice-original-table-app",
      template: "modules/fvtt-bcdice-addon/templates/original-table.html",
      width: 600,
      height: 400,
      resizable: true,
      classes: ["sheet", "bcd-ot-app"],
    };
  }

  async getData(options) {
    let allTables =
      game.settings.get("fvtt-bcdice-addon", "originalTables") || [];

    if (this.activeId === null && allTables.length > 0) {
      this.activeId = allTables[0].id;
    }

    const data = super.getData(options);
    const tablesData = allTables;

    const tables = tablesData.map((table) => {
      const tableLines = table.table?.split("\n") || [];
      const name =
        tableLines[0] ||
        game.i18n.localize("fvtt-bcdice.originalTable.defaultTableName");
      return {
        ...table,
        name: name,
      };
    });

    let activeTable = {
      id: "new",
      command: "",
      table: "",
    };
    if (this.activeId && this.activeId !== "new") {
      activeTable =
        tablesData.find((t) => t.id === this.activeId) || activeTable;
    }

    return {
      ...data,
      tables: tables,
      activeId: this.activeId,
      activeTable: activeTable,
    };
  }

  async _render(force, options) {
    if (!this._initialized) {
      await this._initializeDefaultTable();
      this._initialized = true;
    }
    return await super._render(force, options);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".table-item").on("click", async (event) => {
      const saved = await this.submit({ preventRender: true });
      if (saved) {
        this.activeId = $(event.currentTarget).data("id");
        this.render();
      }
    });

    html.find(".add-table").on("click", async (event) => {
      const saved = await this.submit({ preventRender: true });
      if (!saved) return;
      const newId = foundry.utils.randomID();
      const newTable = {
        id: newId,
        command: "",
        table: "",
      };
      const allTables =
        game.settings.get("fvtt-bcdice-addon", "originalTables") || [];
      allTables.push(newTable);
      await game.settings.set("fvtt-bcdice-addon", "originalTables", allTables);
      this.activeId = newId;
      this.render();
    });

    html.find(".delete-table").on("click", (event) => {
      event.stopPropagation();
      const tableId = $(event.currentTarget).closest(".table-item").data("id");

      Dialog.confirm({
        title: game.i18n.localize("fvtt-bcdice.originalTable.deleteTitle"),
        content: game.i18n.localize(
          "fvtt-bcdice.originalTable.confirmDeleteContent"
        ),
        yes: () => this._deleteTable(tableId),
        no: () => {},
        defaultYes: false,
      });
    });

    html.find('button[name="backup"]').on("click", () => this._onBackup());
    html.find('button[name="restore"]').on("click", () => this._onRestore());

    html
      .find('input[name="command"], textarea[name="table"]')
      .on("change", () => {
        this.submit();
      });
  }

  async _deleteTable(id) {
    const allTables = game.settings.get("fvtt-bcdice-addon", "originalTables");
    const newTables = allTables.filter((t) => t.id !== id);
    await game.settings.set("fvtt-bcdice-addon", "originalTables", newTables);
    if (this.activeId === id) {
      this.activeId = null;
    }
    this.render();
  }

  _onBackup() {
    const allTables = game.settings.get("fvtt-bcdice-addon", "originalTables");
    const data = JSON.stringify(allTables, null, 2);
    saveDataToFile(data, "application/json", "bcdice-original-tables.json");
    ui.notifications.info(
      game.i18n.localize("fvtt-bcdice.originalTable.backupSuccess")
    );
  }

  _onRestore() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      readTextFromFile(file).then((content) => {
        try {
          const data = JSON.parse(content);
          if (!Array.isArray(data)) {
            throw new Error(
              game.i18n.localize(
                "fvtt-bcdice.originalTable.restoreError.notArray"
              )
            );
          }
          Dialog.confirm({
            title: game.i18n.localize("fvtt-bcdice.originalTable.restore"),
            content: game.i18n.localize(
              "fvtt-bcdice.originalTable.confirmRestoreContent"
            ),
            yes: async () => {
              await game.settings.set(
                "fvtt-bcdice-addon",
                "originalTables",
                data
              );
              this.activeId = null;
              this.render();
              ui.notifications.info(
                game.i18n.localize("fvtt-bcdice.originalTable.restoreSuccess")
              );
            },
            no: () => {},
            defaultYes: false,
          });
        } catch (e) {
          ui.notifications.error(
            game.i18n.format(
              "fvtt-bcdice.originalTable.restoreError.readFile",
              {
                message: e.message,
              }
            )
          );
        }
      });
    });

    input.click();
  }

  async _updateObject(event, formData) {
    const commandInput = this.form.querySelector('input[name="command"]');
    const command = formData.command.trim();
    const tableValue = formData.table.trim();

    if (command) {
      if (!/^[a-zA-Z0-9]+$/.test(command)) {
        ui.notifications.error(
          game.i18n.localize(
            "fvtt-bcdice.originalTable.validation.alphanumeric"
          )
        );
        commandInput.classList.add("error");
        return false;
      }

      const allTables = game.settings.get(
        "fvtt-bcdice-addon",
        "originalTables"
      );
      const isDuplicate = allTables.some(
        (table) =>
          table.id !== this.activeId &&
          table.command.toLowerCase() === command.toLowerCase()
      );

      if (isDuplicate) {
        ui.notifications.error(
          game.i18n.format("fvtt-bcdice.originalTable.validation.duplicate", {
            command: command,
          })
        );
        commandInput.classList.add("error");
        return false;
      }
    } else if (tableValue) {
      ui.notifications.error(
        game.i18n.localize(
          "fvtt-bcdice.originalTable.validation.commandRequired"
        )
      );
      commandInput.classList.add("error");
      return false;
    }

    commandInput.classList.remove("error");

    const allTables = game.settings.get("fvtt-bcdice-addon", "originalTables");
    let newTables = foundry.utils.deepClone(allTables);

    const tableIndex = newTables.findIndex((t) => t.id === this.activeId);
    if (tableIndex > -1) {
      newTables[tableIndex].command = command;
      newTables[tableIndex].table = formData.table;
    } else if (this.activeId) {
      return true;
    }

    await game.settings.set("fvtt-bcdice-addon", "originalTables", newTables);
    return true;
  }

  async submit(options = {}) {
    if (this._state === FormApplication.RENDER_STATES.RENDERING) return;
    const formData = this._getSubmitData();
    const saved = await this._updateObject(new Event("submit"), formData);
    if (saved === false) return false;
    if (options.preventRender) {
      return saved;
    }
    await this._render(false, { focus: false });
    return saved;
  }

  async close(options) {
    await this.submit({ preventRender: true });
    return super.close(options);
  }

  async _initializeDefaultTable() {
    let allTables =
      game.settings.get("fvtt-bcdice-addon", "originalTables") || [];
    if (allTables.length === 0) {
      const newId = foundry.utils.randomID();
      const newTable = {
        id: newId,
        command: "",
        table: "",
      };
      allTables.push(newTable);
      await game.settings.set("fvtt-bcdice-addon", "originalTables", allTables);
      this.activeId = newId;
    }
  }
}
