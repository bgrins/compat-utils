import { writeCSV } from "https://deno.land/x/csv/mod.ts";
import caniuse from "https://raw.githubusercontent.com/Fyrd/caniuse/main/fulldata-json/data-2.0.json" assert { type: "json" };

let { data: features, agents } = caniuse;

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
    } else if (latestSupport.startsWith("y")) {
      /* Optionally save with prefixed separately  
    else if (latestSupport.startsWith("y x")) {
      latestSupport = "Yes (prefixed)"; 
    } else if (latestSupport.startsWith("a x")) {
      latestSupport = "Partial (prefixed)";
    }
    */
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

const latestSupport = await Deno.open("./output/caniuse.csv", {
  write: true,
  create: true,
  truncate: true,
});
await writeCSV(latestSupport, output);
latestSupport.close();

const latestSupportOmitUnofficial = await Deno.open(
  "./output/caniuse-omit-unoff.csv",
  {
    write: true,
    create: true,
    truncate: true,
  }
);
await writeCSV(
  latestSupportOmitUnofficial,
  output.filter((r) => r[1] !== "unoff")
);
latestSupportOmitUnofficial.close();
