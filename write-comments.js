import {
  REPOS,
  GH_TOKEN,
  jmespath,
  moment,
  json_to_csv,
  fetchWithToken,
} from "./deps.js";

console.log(`Has an API token? ${!!GH_TOKEN}`);

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
