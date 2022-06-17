import {
  REPOS,
  GH_TOKEN,
  jmespath,
  parseLinkHeader,
  json_to_csv,
  fetchWithToken,
} from "./deps.js";

console.log(`Has an API token? ${!!GH_TOKEN}`);

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
  // Todo - special case s-p to pull the standards link and other details from first comment
  if (repo == "mozilla/standards-positions") {
  }
}
