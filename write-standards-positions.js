import { writeCSV } from "https://deno.land/x/csv/mod.ts";
import { parseLinkHeader } from "./parselinkheader.js";

// import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";
// let resp = await octokit.rest.issues.listForRepo({
//   owner: "mozilla",
//   repo: "standards-positions",
//   page,
//   per_page: 100,
// });
// const octokit = new Octokit();

let output = [["Title", "URL", "Created", "Updated", "Labels"]];
async function getIssues(url) {
  let resp = await fetch(url);
  let data = await resp.json();
  let linkHeader = parseLinkHeader(resp.headers.get("Link"));
  for (let issue of data) {
    output.push([
      issue.title,
      issue.html_url,
      issue.created_at,
      issue.updated_at,
      issue.labels.map(l => l.name).join(",")
    ]);
  }

  for (let link of linkHeader) {
    if (link.rel == "next") {
      await getIssues(link.uri);
    }
  }
}

await getIssues(
  "https://api.github.com/repositories/101806313/issues?page=1&per_page=100"
);

const standardsPositions = await Deno.open("./output/standards-positions.csv", {
  write: true,
  create: true,
  truncate: true,
});
await writeCSV(standardsPositions, output);
standardsPositions.close();
