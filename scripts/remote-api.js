import { APIError } from "./errors.js";

function getDiceServer() {
  return (
    game.settings.get("fvtt-bcdice-addon", "bc-server") ??
    "https://bcdice.onlinesession.app/v2"
  );
}

let _cachedSystems;
export async function getSystems() {
  if (!_cachedSystems) {
    try {
      const request = await fetch(`${getDiceServer()}/game_system`);
      _cachedSystems = (await request.json()).game_system;
    } catch (e) {
      console.error("BCDice: Error fetching systems.", e);
      return [];
    }
  }
  const isV12Plus = foundry.utils.isNewerVersion(game.version, "12");
  // v12 or later
  if (isV12Plus) {
    return foundry.utils.duplicate(_cachedSystems);
  }
  // under v11
  else {
    return duplicate(_cachedSystems);
  }
}

export async function getHelpText(system) {
  return doRequest(`${getDiceServer()}/game_system/${system}`);
}

export async function getRoll(system, command) {
  const url = new URL(`${getDiceServer()}/game_system/${system}/roll`);
  const params = url.searchParams;
  params.append("command", command);
  return doRequest(url);
}

export async function rollOriginalTable(tableText) {
  const url = new URL(`${getDiceServer()}/original_table`);
  url.searchParams.append("table", tableText);
  const request = await fetch(url.toString(), {
    method: "POST",
  });
  if (!request.ok) {
    throw new APIError(
      "BCDice API Error (Original Table)",
      request,
      `API returned status ${request.status}`
    );
  }
  const data = await request.json();
  if (!data.ok) {
    throw new APIError(
      "BCDice API Error (Original Table)",
      request,
      data.reason || `API returned with ok:false`
    );
  }
  return data;
}

export async function doRequest(url) {
  const request = await fetch(url);
  if (!request.ok) {
    throw new APIError(
      "There was an error from the API.",
      request,
      `API returned status ${request.status}`
    );
  }
  const data = await request.json();
  if (!data.ok) {
    throw new APIError(
      "There was an error from the API.",
      request,
      data.reason
    );
  }
  return data;
}
