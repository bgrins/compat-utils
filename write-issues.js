import { parseLinkHeader } from "./parselinkheader.js";
import { configSync } from "https://deno.land/std@0.137.0/dotenv/mod.ts";
import jmespath from "https://cdn.skypack.dev/jmespath";
import papaparse from "https://esm.sh/papaparse/";

const CONFIG = configSync();
const { GH_TOKEN } = CONFIG;

console.log(`Has an API token? ${!!GH_TOKEN}`);

function json_to_csv({ input, options = {} }) {
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

const REPOS = [
  "mozilla/standards-positions",
  "w3ctag/design-reviews",
  "whatwg/html",
  "whatwg/dom",
  "whatwg/webidl",
  "whatwg/encoding",
  "w3c/editing",
  "whatwg/notifications",
  "whatwg/fullscreen",
  "WICG/webcomponents",
  "w3c/pointerevents",
  // "w3c/clipboard-api",
  "w3c/pointerlock",
  "w3c/editcontext",
  // "w3c/input-event",
];

async function fetchIssues(initialURL) {
  let output = [];
  async function getIssues(url) {
    console.log("Getting issues from", url);
    let resp = await fetch(url, {
      headers: {
        Authorization: GH_TOKEN ? `Bearer ${GH_TOKEN}` : "",
      },
    });
    let data = await resp.json();
    let linkHeader = resp.headers.get("Link")
      ? parseLinkHeader(resp.headers.get("Link"))
      : [];

    const filtered = jmespath.search(
      data,
      "[].{closed: state, title: title, url: html_url, created_at: created_at, updated_at: updated_at, user: user.login, labels: labels, reactions: reactions.total_count, id: id  }"
    );
    for (let issue of filtered) {
      issue.labels = issue.labels.map((l) => l.name).join("|");
      // Map state onto a boolean
      issue.closed = issue.closed == "closed";
    }
    output = output.concat(filtered);

    for (let link of linkHeader) {
      if (link.rel == "next") {
        await getIssues(link.uri);
      }
    }
  }
  await getIssues(initialURL);
  return output;
}

for (const repo of REPOS) {
  let output = await fetchIssues(
    `https://api.github.com/repos/${repo}/issues?per_page=1000&state=all` // &sort=updated
  );
  console.log(output);
  Deno.writeTextFileSync(
    `./output/${repo.replace("/", "-")}.csv`,
    json_to_csv({
      input: output,
    })
  );
}
