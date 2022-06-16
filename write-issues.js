import { parseLinkHeader } from "./parselinkheader.js";
import { configSync } from "https://deno.land/std@0.137.0/dotenv/mod.ts";
import jmespath from "https://cdn.skypack.dev/jmespath";
import papaparse from "https://esm.sh/papaparse/";
import moment from "https://esm.sh/moment";

const CONFIG = Object.assign({}, Deno.env.toObject(), configSync());
const { GH_TOKEN } = CONFIG;
const FETCH_ISSUES = true;

console.log(`Has an API token? ${!!GH_TOKEN}`);

function fetchWithToken(url) {
  return fetch(url, {
    headers: {
      Authorization: GH_TOKEN ? `Bearer ${GH_TOKEN}` : "",
    },
  });
}

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

// Todo: for these really big repos maybe grab all open and then only closed ones that were updated in the last N days?
const REPOS = [
  "mozilla/standards-positions",
  "w3ctag/design-reviews",
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
  "whatwg/html",
];

async function fetchIssues(initialURL) {
  let output = [];
  async function getIssues(url) {
    console.log("Getting issues from", url);
    let resp = await fetchWithToken(url);
    let data = await resp.json();
    let linkHeader = resp.headers.get("Link")
      ? parseLinkHeader(resp.headers.get("Link"))
      : [];

    if (!Array.isArray(data)) {
      console.error(data);
      throw new Error("Expected an array but got " + JSON.stringify(data));
    }
    const filtered = jmespath.search(
      data,
      "[].{id: id, closed: state, title: title, url: html_url, created_at: created_at, updated_at: updated_at, user: user.login, labels: labels, reactions: reactions.total_count }"
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
  console.log(
    `Got ${output.length} issues (${
      output.filter((i) => !i.closed).length
    } open and ${output.filter((i) => i.closed).length} closed)`
  );
  return output;
}

async function fetchIssueComments() {
  let since = moment().subtract(2, "week").toISOString();
  console.log(`Fetching since ${since}`);
  let allComments = [];
  const issueURLToMetadata = {};

  for (const repo of REPOS) {
    let resp = await fetchWithToken(
      `https://api.github.com/repos/${repo}/issues/comments?per_page=1000&sort=created&direction=desc&since=${since}`
    );
    // let resp = await fetch(`https://api.github.com/repos/${repo}/issues/events?per_page=1000`);
    let data = await resp.json();

    const filtered = jmespath.search(
      data,
      "[].{id: id, repo: '', body: body, url: html_url, issue_url: issue_url, issue_title: '', created_at: created_at, user: user.login }"
    );

    for (let comment of filtered) {
      comment.repo = repo;
      comment.body = comment.body
        .substring(0, 100)
        .replaceAll("\r\n", " ")
        .replaceAll("\n", " ");

      if (!issueURLToMetadata[comment.issue_url]) {
        console.log(`Fetching issue metadata from ${comment.issue_url}`);
        let json = await (await fetchWithToken(comment.issue_url)).json();
        issueURLToMetadata[comment.issue_url] = {
          issue_url: json.html_url,
          issue_title: json.title,
        };
      }
      let metadata = issueURLToMetadata[comment.issue_url];
      // console.log(metadata);

      comment.issue_url = metadata.issue_url;
      comment.issue_title = metadata.issue_title;
    }
    allComments = allComments.concat(filtered);
  }

  allComments.sort((a, b) => {
    return moment(a.created_at) < moment(b.created_at) ? 1 : -1;
  });
  return allComments;
}

let allComments = await fetchIssueComments();

Deno.writeTextFileSync(
  `./output/all-comments.csv`,
  json_to_csv({
    input: allComments,
  })
);

if (FETCH_ISSUES) {
  for (const repo of REPOS) {
    let output = await fetchIssues(
      `https://api.github.com/repos/${repo}/issues?per_page=1000&state=all` // &sort=updated
    );

    // console.log(output);
    Deno.writeTextFileSync(
      `./output/${repo.replace("/", "-")}.csv`,
      json_to_csv({
        input: output,
      })
    );
  }
}
