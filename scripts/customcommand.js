import { roll } from "./dsn-utilities.js";

/**
 * Execute BCDice comannds.
 */
export async function customCommand(command, messageData, parameters) {
  const rollFormula = parameters || "";

  if (rollFormula !== "") {
    const system =
      game.user.getFlag("fvtt-bcdice", "sys-id") ??
      game.settings.get("fvtt-bcdice", "game-system");

    roll(system, rollFormula);
  }
}
