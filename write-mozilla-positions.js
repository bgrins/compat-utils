import activities_json from "https://raw.githubusercontent.com/mozilla/standards-positions/main/activities.json" assert { type: "json" };
import {
  json_to_csv,
  csv_to_json,
  parseLinkHeader,
  fetchWithToken,
  fetchIssues,
} from "./deps.js";
import { parse } from "https://deno.land/std@0.119.0/flags/mod.ts";

const flags = parse(Deno.args, {
  process_project: false,
});
const { "backfill-project-metadata": backfill_project_metadata } = flags;

const known_labels = new Map([
  ["position: positive", "positive"],
  ["position: neutral", "neutral"],
  ["position: negative", "negative"],
  ["position: defer", "defer"],
  ["position: under consideration", "under consideration"],
]);
const known_labels_values = new Set(Array.from(known_labels.values()));

const activities_json_map = new Map(
  activities_json.map((pos) => {
    const issue_id = pos.mozPositionIssue;
    const issue_position = pos.mozPosition;
    if (!known_labels_values.has(issue_position)) {
      throw new Error(
        `Unknown position ${issue_position} for issue ${issue_id}`
      );
    }
    return [
      issue_id,
      {
        issue_position: pos.mozPosition,
        issue_id,
        issue_url: `https://github.com/mozilla/standards-positions/issues/${issue_id}`,
      },
    ];
  })
);

const mozilla_issues = new Map(
  csv_to_json({
    input: Deno.readTextFileSync(`./output/mozilla-standards-positions.csv`),
  }).map((i) => {
    let issue_id = parseInt(i.url.match(/\/([0-9]*)$/)[1]);
    let issue_position = i.labels
      .split("|")
      .filter((l) => known_labels.has(l))
      .map((l) => known_labels.get(l));
    if (issue_position.length > 1) {
      throw new Error(`More than one position label for issue ${i.id}`);
    }
    return {
      issue_id,
      issue_url: i.url,
      issue_position: issue_position?.[0],
    };
    // return [id, relevant_labels.length ? relevant_labels[0] : null];
  })
);

const mozilla_issues_with_labels = new Map(
  [...mozilla_issues].filter((i) => i.issue_position)
);

// Sanity check for no conflicting labels between the data sources
for (let { id, issue_position } of mozilla_issues_with_labels) {
  if (activities_json_map.has(id)) {
    const pos = activities_json_map.get(id);
    if (pos !== issue_position) {
      throw new Error(
        `Conflicting labels for ${id}: ${pos} vs ${issue_position}`
      );
    } else {
      console.log(
        `Label is issue and also specified activities.json for ${id}: ${pos}`
      );
    }
  }
}

// Merge the objects (activities.json takes priority)
const combined_issues = new Map([
  ...mozilla_issues_with_labels,
  ...activities_json_map,
]);

console.log(`Total number of positions`);
console.table({
  mozilla_issues: mozilla_issues.size,
  mozilla_issues_with_labels: mozilla_issues_with_labels.size,
  activities_json_map: activities_json_map.size,
  "": [],
  combined_issues: combined_issues.size,
});

Deno.writeTextFileSync(
  `./output/combined-standards-positions.json`,
  JSON.stringify(Array.from(combined_issues.values()), null, 2)
);

function mapResponse(data) {
  return data.map((i) => {
    const extracted = {
      "Specification Title": i.body
        ?.match(/Specification Title:\s*(.*)/)?.[1]
        ?.trim(),
      "Specification or proposal URL": i.body
        ?.match(/Specification or proposal URL:\s*(.*)/)?.[1]
        ?.trim(),
      "Caniuse.com URL (optional)": i.body
        ?.match(/Caniuse.com URL \(optional\):\s*(.*)/)?.[1]
        ?.trim(),
      "Bugzilla URL (optional)": i.body
        ?.match(/Bugzilla URL \(optional\):\s*(.*)/)?.[1]
        ?.trim(),
      "Mozillians who can provide input (optional)": i.body
        ?.match(/Mozillians who can provide input \(optional\):\s*(.*)/)?.[1]
        ?.trim(),
    };
    return {
      id: i.id,
      url: i.html_url,
      title: i.title,
      extracted,
    };
  });
}


// let { issues } = await fetchIssues(
//   `https://api.github.com/repos/mozilla/standards-positions/issues?per_page=1000&state=all` // &sort=updated
// );

// issues = mapResponse(issues);

// console.log(issues);

async function getAllProjectItems({ project_id }) {
  const output = { nodes: [] };

  async function fetchProjectItems({ endCursor } = {}) {
    let resp = await fetchWithToken("https://api.github.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
      
    query($project_id: ID!, $endCursor: String) {
      node(id: $project_id) {
          ... on ProjectV2 {
            items(first: 100, after: $endCursor) {
              nodes{
                id
                fieldValues(first: 8) {
                  nodes{                
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                  }              
                }
                content{
                  ...on Issue {
                    title
                    body
                    bodyHTML
                    bodyText
                    url
                    id
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
        rateLimit {
          limit     # Your maximum budget. Your budget is reset to this every hour.
          cost      # The cost of this query.
          remaining # How much of your API budget remains.
          resetAt   # The time (in UTC epoch seconds) when your budget will reset.
        }
  }
  `,
        variables: {
          project_id,
          endCursor,
        },
      }),
    });
    let { data } = await resp.json();
    console.log(data);
    output.nodes = output.nodes.concat(...data.node.items.nodes);

    if (data.node.items.pageInfo.hasNextPage) {
      console.log("another page");
      await fetchProjectItems({
        endCursor: data.node.items.pageInfo.endCursor,
      });
    }
  }

  await fetchProjectItems();
  return output;
}

if (backfill_project_metadata) {
  let items = await getAllProjectItems({
    project_id: "PVT_kwDOAAIBxM4AItcO",
  });
  console.log(items);
  Deno.writeTextFileSync(
    "temp/temp-api-results.json",
    JSON.stringify(items, null, 2)
  );
}
