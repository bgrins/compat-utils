import specs from "https://raw.githubusercontent.com/w3c/browser-specs/main/index.json" assert { type: "json" };

let orgs = new Set(specs.map(s => s.organization));
let orgsMap = new Map([...orgs].map(o => [o, specs.filter(s => s.organization === o).length]));

let output = {
  specs_per_org: Object.fromEntries(orgsMap),
}
Deno.writeTextFileSync(
  "./output/webspecs_summary.json",
  JSON.stringify(output, null, 2)
);
Deno.writeTextFileSync(
  "./output/webspecs_index.json",
  JSON.stringify(specs, null, 2)
);