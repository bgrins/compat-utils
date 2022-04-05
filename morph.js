import { writeCSV } from "https://deno.land/x/csv/mod.ts";

let { data: features, agents } = JSON.parse(
  await Deno.readTextFile("data-2.0.json")
);
let browsers = {
  firefox: agents["firefox"].version_list.at(-1).version,
  safari: agents["safari"].version_list.at(-1).version,
  chrome: agents["chrome"].version_list.at(-1).version,
};

let output = [
  [
    "Feature Name",
    "Status",
    "Categories",
    `Firefox ${browsers.firefox}`,
    `Safari ${browsers.safari}`,
    `Chrome ${browsers.chrome}`,
  ],
];

for (let featurename in features) {
  let feature = features[featurename];
  let row = [featurename, feature.status, feature.categories.join(",")];
  for (let browser in browsers) {
    let latestSupport = feature.stats[browser][browsers[browser]];

    row.push(latestSupport);
  }
  output.push(row);
}

const f = await Deno.open("./latest-support.csv", {
  write: true,
  create: true,
  truncate: true,
});
await writeCSV(f, output);
f.close();
