import { writeCSV } from "https://deno.land/x/csv/mod.ts";
import { parseLinkHeader } from "./parselinkheader.js";

// import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";
// const octokit = new Octokit();
// let resp = await octokit.rest.issues.listForRepo({
//   owner: "w3ctag",
//   repo: "design-reviews",
//   per_page: 1,
// });
// console.log(resp);

async function fetchIssues(initialURL) {
  let output = [["Title", "URL", "Created", "Updated", "Labels"]];
  async function getIssues(url) {
    let resp = await fetch(url);
    let data = await resp.json();
    let linkHeader = resp.headers.get("Link")
      ? parseLinkHeader(resp.headers.get("Link"))
      : [];
    for (let issue of data) {
      output.push([
        issue.title,
        issue.html_url,
        issue.created_at,
        issue.updated_at,
        issue.labels.map((l) => l.name).join(","),
      ]);
    }

    for (let link of linkHeader) {
      if (link.rel == "next") {
        await getIssues(link.uri);
      }
    }
  }
  await getIssues(initialURL);
  return output;
}

// mozilla/standards-positions
let output = await fetchIssues(
  "https://api.github.com/repositories/101806313/issues?page=1&per_page=100"
);

let file = await Deno.open("./output/standards-positions.csv", {
  write: true,
  create: true,
  truncate: true,
});
await writeCSV(file, output);
file.close();

// w3ctag/design-reviews
output = await fetchIssues(
  "https://api.github.com/repositories/11005977/issues?page=1&per_page=100"
);
file = await Deno.open("./output/design-reviews.csv", {
  write: true,
  create: true,
  truncate: true,
});
await writeCSV(file, output);
file.close();
