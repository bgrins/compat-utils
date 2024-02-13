import specs from "https://raw.githubusercontent.com/w3c/browser-specs/main/index.json" assert { type: "json" };

// Schema at https://github.com/w3c/browser-specs
// See also https://www.specref.org/

console.log(specs.map(s=> s.title));

let missing_nightly = specs.filter((s) => !s.nightly);
if (missing_nightly.length) {
  console.error("Missing nightly", missing_nightly);
}


let orgs_map = new Map(
  [...new Set(specs.map((s) => s.organization))].map((o) => [
    o,
    specs.filter((s) => s.organization === o).length,
  ])
);
let standing_map = new Map(
  [...new Set(specs.map((s) => s.standing))].map((o) => [
    o,
    specs.filter((s) => s.standing === o).length,
  ])
);
let source_map = new Map(
  [...new Set(specs.map((s) => s.source))].map((o) => [
    o,
    specs.filter((s) => s.source === o).length,
  ])
);
let series_map = new Map(
  [...new Set(specs.map((s) => s.seriesComposition))].map((o) => [
    o,
    specs.filter((s) => s.seriesComposition === o).length,
  ])
);
let repo_url_map = new Map(
  [
    ...new Set(
      specs
        .filter((s) => s.nightly.repository && s.nightly.sourcePath)
        .map((s) => new URL(s.nightly.repository + s.nightly.sourcePath).host)
    ),
  ].map((o) => [
    o,
    specs.filter(
      (s) =>
        s.nightly.repository &&
        s.nightly.sourcePath &&
        new URL(s.nightly.repository).host === o
    ).length,
  ])
);
let groups_map = new Map(
  [...new Set([...specs.map((s) => s.groups.map((g) => g.name))])].map((o) => [
    o,
    specs.filter((s) => s.groups.find((g) => g.name == o)).length,
  ])
);

let output = {
  specs_per_org: Object.fromEntries(orgs_map),
  specs_per_standing: Object.fromEntries(standing_map),
  specs_per_source: Object.fromEntries(source_map),
  specs_per_series: Object.fromEntries(series_map),
  specs_per_group: Object.fromEntries(groups_map),
  specs_per_repo_host: Object.fromEntries(repo_url_map),
};

console.log(
  specs.length,
  specs.filter((spec) => spec.nightly.repository).length
);
// console.log(specs.length, specs.filter((spec) => spec.nightly.url).length);
// console.log(specs.length, specs.filter((spec) => spec.nightly.filename).length);
// console.log(
//   specs.length,
//   specs.filter((spec) => spec.nightly.sourcePath).length
// );

// console.log(specs.filter((spec) => !spec.nightly.repository));
Deno.writeTextFileSync(
  "./output/webspecs_summary.json",
  JSON.stringify(output, null, 2)
);
Deno.writeTextFileSync(
  "./output/webspecs_index.json",
  JSON.stringify(specs, null, 2)
);
