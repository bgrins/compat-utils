import activities_json from "https://raw.githubusercontent.com/mozilla/standards-positions/main/activities.json" assert { type: "json" };
import { csv_to_json, fetchWithToken, GH_PROJECT_ID } from "./deps.js";
import { parse } from "https://deno.land/std@0.119.0/flags/mod.ts";
import { ensureDirSync } from "https://deno.land/std@0.119.0/fs/mod.ts";

const flags = parse(Deno.args, {
  backfill_project_metadata: false,
  remote_fetch_project_issues: false,
});
const {
  "backfill-project-metadata": backfill_project_metadata,
  "remote-fetch-project-issues": remote_fetch_project_issues,
} = flags;

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

function extract_from_body(body) {
  // The titles here map to field names in the project
  const extracted = {
    "Specification Title": body
      ?.match(/Specification Title:\w*(.*)/)?.[1]
      ?.trim(),
    "Spec URL": body
      ?.match(/Specification or proposal URL:\w*(.*)/)?.[1]
      ?.trim(),
    "Caniuse URL": body
      ?.match(/Caniuse.com URL \(optional\):\w*(.*)/)?.[1]
      ?.trim(),
    "Bugzilla URL": body
      ?.match(/Bugzilla URL \(optional\):\w*(.*)/)?.[1]
      ?.trim(),
    "Suggested input": body
      ?.match(/Mozillians who can provide input \(optional\):\w*(.*)/)?.[1]
      ?.trim(),
  };
  return extracted;
}

async function get_field_to_id_mapping() {
  const query = `
    query($project_id: ID!) {
      node(id: $project_id) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2FieldCommon {
                id
                name
              }
            }
          }
        }
      }
    }`;
  const response = await fetchWithToken(`https://api.github.com/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        project_id: GH_PROJECT_ID,
      },
    }),
  });
  const json = await response.json();
  // console.log(json);
  const fields = json.data.node.fields.nodes;
  const field_ids = new Map(fields.map((f) => [f.name, f.id]));
  return Object.fromEntries(field_ids);
}

async function get_all_project_items({ project_id }) {
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
                type
                fieldValues(first: 8) {
                  nodes{                
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                          id
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                          id
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                          id
                        }
                      }
                    }
                  }              
                }
                content{
                  ...on Issue {
                    id
                    url
                    title
                    body
                    bodyHTML,
                    bodyText
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
      console.log(
        `Adding another page with ${data.node.items.pageInfo.endCursor}`
      );
      await fetchProjectItems({
        endCursor: data.node.items.pageInfo.endCursor,
      });
    }
  }

  await fetchProjectItems();
  return output;
}

// This is a one time job to fill a project board with structured metadata pulled out of issue bodies based on a template
if (backfill_project_metadata) {
  let field_name_to_id = await get_field_to_id_mapping();
  console.log(field_name_to_id);
  let items;
  if (remote_fetch_project_issues) {
    items = await get_all_project_items({
      project_id: GH_PROJECT_ID,
    });
    console.log(items);
    Deno.writeTextFileSync(
      "temp/graphql_results.json",
      JSON.stringify(items, null, 2)
    );
  } else {
    items = JSON.parse(Deno.readTextFileSync("./temp/graphql_results.json"));
  }
  let issues = items.nodes.filter((i) => i.type === "ISSUE");
  let prs = items.nodes.filter((i) => i.type === "PULL_REQUEST");
  console.log(
    `Found ${items.nodes.length} items (${issues.length} issues and ${prs.length} PRs)`
  );
  let issues_metadata = new Map(
    issues.map((i) => [i.content.url, extract_from_body(i.content.body)])
  );
  ensureDirSync("./temp");
  Deno.writeTextFileSync(
    "temp/project_response.json",
    JSON.stringify(issues, null, 2)
  );
  Deno.writeTextFileSync(
    "temp/issues_metadata.json",
    JSON.stringify(Object.fromEntries(issues_metadata), null, 2)
  );

  // Now write back issues_metadata to the graphql api when the corresponding field
  // isn't already set on the item:
  let items_to_update = [];
  for (let item of issues) {
    let issue_metadata = issues_metadata.get(item.content.url);
    if (!issue_metadata) {
      console.warn("No metadata for", item.content.url);
      continue;
    }
    for (let field of Object.keys(field_name_to_id)) {
      if (
        !item.fieldValues.nodes.find(
          (f) => f.field?.name === field && f.text
        ) &&
        issue_metadata[field]
      ) {
        // console.log(
        //   field,
        //   item.fieldValues.nodes,
        //   item.fieldValues.nodes.find((f) => f.field?.name === field)
        // );
        items_to_update.push({
          id: item.id,
          url: item.content.url,
          field,
          field_id: field_name_to_id[field],
          value: issue_metadata[field],
        });
      }
    }
  }
  Deno.writeTextFileSync(
    "temp/issues_to_update.json",
    JSON.stringify(items_to_update, null, 2)
  );

  console.log(`Found ${items_to_update.length} items to update`);

  // Summarize how many items_to_update we have for each unique field:
  let field_counts = {};
  for (let item of items_to_update) {
    if (!field_counts[item.field]) {
      field_counts[item.field] = 0;
    }
    field_counts[item.field]++;
  }
  console.table(field_counts);

  let issues_to_update = 500;
  for (let item of items_to_update) {
    let resp = await fetchWithToken("https://api.github.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
        mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $value: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $project_id
            itemId: $item_id
            fieldId: $field_id
            value: {
              text: $value
            }
          }) {
            projectV2Item {
              id
            }
          }
        }
        `,
        variables: {
          project_id: GH_PROJECT_ID,
          item_id: item.id,
          field_id: item.field_id,
          value: item.value,
        },
      }),
    });

    console.log({
      item_id: item.id,
      field: item.field,
      field_id: item.field_id,
      value: {
        text: item.value,
      },
    });
    let data = await resp.json();
    console.log(data);

    if (issues_to_update-- === 0) {
      break;
    }
  }
}
