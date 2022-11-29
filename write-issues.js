import {
  REPOS,
  GH_TOKEN,
  jmespath,
  json_to_csv,
  fetchIssues,
} from "./deps.js";
console.log(`Has an API token? ${!!GH_TOKEN}`);

function mapResponse(data) {
  const filtered = jmespath.search(
    data,
    "[].{id: id, closed: state, title: title, url: html_url, created_at: created_at, updated_at: updated_at, user: user.login, labels: labels, reactions: reactions.total_count }"
  );
  for (let issue of filtered) {
    issue.labels = issue.labels.map((l) => l.name).join("|");
    // Map state onto a boolean
    issue.closed = issue.closed == "closed";
  }

  return filtered;
}

for (const repo of REPOS) {
  let { issues, prs } = await fetchIssues(
    `https://api.github.com/repos/${repo}/issues?per_page=1000&state=all` // &sort=updated
  );

  issues = mapResponse(issues);
  prs = mapResponse(prs);

  // console.log(output);
  Deno.writeTextFileSync(
    `./output/${repo.replace("/", "-")}.csv`,
    json_to_csv({
      input: issues,
    })
  );
  Deno.writeTextFileSync(
    `./output/${repo.replace("/", "-")}-prs.csv`,
    json_to_csv({
      input: prs,
    })
  );
}
