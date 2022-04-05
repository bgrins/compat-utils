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
    if (latestSupport.startsWith("n")) {
      latestSupport = "No";
    }

    /* Optionally save with prefixed separately  
    else if (latestSupport.startsWith("y x")) {
      latestSupport = "Yes (prefixed)"; 
    } else if (latestSupport.startsWith("a x")) {
      latestSupport = "Partial (prefixed)";
    }
    */
    else if (latestSupport.startsWith("y")) {
      latestSupport = "Yes";
    } else if (latestSupport.startsWith("a") || latestSupport.startsWith("p")) {
      latestSupport = "Partial";
    } else if (latestSupport.startsWith("u")) {
      latestSupport = "Unknown";
    } else {
      throw new Error(`Unhandled support case: ${latestSupport}`);
    }

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
