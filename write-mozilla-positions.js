import activities_json from "https://raw.githubusercontent.com/mozilla/standards-positions/main/activities.json" assert { type: "json" };

import { json_to_csv, csv_to_json } from "./deps.js";

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
    return [pos.mozPositionIssue, pos.mozPosition];
  })
);

// Sanity check that pos.mozPosition is always an expected label
for (let [issue, pos] of activities_json_map) {
  if (!known_labels_values.has(pos)) {
    throw new Error(`Unknown position ${pos} for issue ${issue}`);
  }
}

const mozilla_issues = new Map(
  csv_to_json({
    input: Deno.readTextFileSync(`./output/mozilla-standards-positions.csv`),
  }).map((i) => {
    let id = parseInt(i.url.match(/\/([0-9]*)$/)[1]);
    let relevant_labels = i.labels
      .split("|")
      .filter((l) => known_labels.has(l))
      .map((l) => known_labels.get(l));
    if (relevant_labels.length > 1) {
      throw new Error(`More than one position label for issue ${i.id}`);
    }
    return [id, relevant_labels.length ? relevant_labels[0] : null];
  })
);

const mozilla_issues_with_labels = new Map(
  [...mozilla_issues].filter((i) => i[1])
);

// Sanity check for no conflicting labels between the data sources
for (let [id, issue_position] of mozilla_issues_with_labels) {
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

console.log([["id", "position"]].concat(Array.from(combined_issues)));
Deno.writeTextFileSync(
  `./output/combined-standards-positions.csv`,
  "id,position\n" +
    json_to_csv({
      input: Array.from(combined_issues),
    })
);
