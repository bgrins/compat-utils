export { default as jmespath } from "https://cdn.skypack.dev/jmespath";
export { default as moment } from "https://esm.sh/moment";
import { parseLinkHeader } from "./parselinkheader.js";
export { parseLinkHeader };

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
  "w3c/clipboard-apis",
  "whatwg/html",
];

import { configSync } from "https://deno.land/std@0.137.0/dotenv/mod.ts";
const CONFIG = Object.assign({}, Deno.env.toObject(), configSync());
export const { GH_TOKEN, GH_PROJECT_ID } = CONFIG;

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

export function csv_to_json({ input, options = {} }) {
  let header =
    options.header === false || options.header === "false" ? false : true;
  const json = papaparse.parse(input, { header });
  // Note: this returns an object like `{ data: [], errors: [], meta: [] }`.
  // Just throw on any error and return `data`
  if (json.errors.length) {
    console.error(json);
    throw new Error(
      "Error transforming csv to json: " + JSON.stringify(json.errors)
    );
  }
  return json.data;
}

export function fetchWithToken(url, options = {}) {
  options.headers = Object.assign(
    {
      Authorization: GH_TOKEN ? `Bearer ${GH_TOKEN}` : "",
    },
    options.headers || {}
  );
  return fetch(url, options);
}

export async function fetchIssues(initialURL) {
  let output = {
    issues: [],
    prs: [],
  };
  async function getIssues(url) {
    console.log("Getting issues from", url);
    let resp = await fetchWithToken(url);
    let data = await resp.json();

    if (resp.status >= 400) {
      throw new Error(
        `Error fetching issues from ${url}: ${resp.status} ${resp.statusText}`
      );
    }

    let linkHeader = (
      resp.headers.get("Link") ? parseLinkHeader(resp.headers.get("Link")) : []
    ).find((link) => link.rel == "next");

    if (!Array.isArray(data)) {
      console.error(data);
      throw new Error("Expected an array but got " + JSON.stringify(data));
    }

    let issues = data.filter((i) => !i.pull_request);
    let prs = data.filter((i) => i.pull_request);

    output.issues = output.issues.concat(issues);
    output.prs = output.prs.concat(prs);
    if (linkHeader) {
      await getIssues(linkHeader.uri);
    }
  }
  await getIssues(initialURL);

  console.log(
    `Got ${output.issues.length} issues (${
      output.issues.filter((i) => i.state != "closed").length
    } open and ${
      output.issues.filter((i) => i.state == "closed").length
    } closed)`
  );
  console.log(
    `Got ${output.prs.length} PRs (${
      output.prs.filter((i) => i.state != "closed").length
    } open and ${output.prs.filter((i) => i.state == "closed").length} closed)`
  );
  return output;
}
