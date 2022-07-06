
export { default as jmespath } from "https://cdn.skypack.dev/jmespath";
export { default as moment } from "https://esm.sh/moment";
export { parseLinkHeader } from "./parselinkheader.js";

import papaparse from "https://esm.sh/papaparse/";

export const REPOS = [
  "mozilla/standards-positions",
  "webkit/standards-positions",
  "w3ctag/design-reviews",
  "whatwg/dom",
  "whatwg/webidl",
  "whatwg/encoding",
  "w3c/editing",
  "whatwg/notifications",
  "whatwg/fullscreen",
  "WICG/webcomponents",
  "w3c/pointerevents",
  "w3c/pointerlock",
  "w3c/editcontext",
  "whatwg/html",
];

import { configSync } from "https://deno.land/std@0.137.0/dotenv/mod.ts";
const CONFIG = Object.assign({}, Deno.env.toObject(), configSync());
export const { GH_TOKEN } = CONFIG;

export function json_to_csv({ input, options = {} }) {
  let header =
    options.header === false || options.header === "false" ? false : true;
  let newline = options.newline || "\n";
  let opts = {
    header,
    newline,
  };
  const csv = papaparse.unparse(input, opts);
  return csv;
}

export function fetchWithToken(url) {
  return fetch(url, {
    headers: {
      Authorization: GH_TOKEN ? `Bearer ${GH_TOKEN}` : "",
    },
  });
}
