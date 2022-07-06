import {
  REPOS,
  GH_TOKEN,
  jmespath,
  moment,
  json_to_csv,
  fetchWithToken,
  parseLinkHeader,
} from "./deps.js";

console.log(`Has an API token? ${!!GH_TOKEN}`);

const ISSUE_URL_TO_METADATA = {};

async function fetchIssueComments() {
  let since = moment().subtract(2, "week").toISOString();
  console.log(`Fetching since ${since}`);
  let allComments = [];

  for (const repo of REPOS) {
    await getIssueComments(
      `https://api.github.com/repos/${repo}/issues/comments?per_page=1000&sort=created&direction=desc&since=${since}`,
      repo
    );
  }
  async function getIssueComments(url, repo) {
    let resp = await fetchWithToken(url);

    let linkHeader = (
      resp.headers.get("Link") ? parseLinkHeader(resp.headers.get("Link")) : []
    ).find((link) => link.rel == "next");

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

      if (!ISSUE_URL_TO_METADATA[comment.issue_url]) {
        console.log(`Fetching issue metadata from ${comment.issue_url}`);
        let json = await (await fetchWithToken(comment.issue_url)).json();
        ISSUE_URL_TO_METADATA[comment.issue_url] = {
          issue_url: json.html_url,
          issue_title: json.title,
        };
      }
      let metadata = ISSUE_URL_TO_METADATA[comment.issue_url];
      // console.log(metadata);

      comment.issue_url = metadata.issue_url;
      comment.issue_title = metadata.issue_title;
    }
    allComments = allComments.concat(filtered);

    if (linkHeader) {
      await getIssueComments(linkHeader.uri, repo);
    }
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
