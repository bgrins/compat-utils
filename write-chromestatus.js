import features from "https://chromestatus.com/features_v2.json" assert { type: "json" };
import { json_to_csv } from "./deps.js";

let featureMeta = features
  .map((feat) => {
    return {
      id: feat.id,
      url: `https://chromestatus.com/feature/${feat.id}`,
      name: feat.name,
      summary: feat.summary
        ?.substring(0, 100)
        .replaceAll("\r\n", " ")
        .replaceAll("\n", " "),
      standards_spec: feat.standards.spec,
      standards_maturity: feat.standards.maturity.short_text,
      fx_view_url: feat.browsers.ff.view.url,
      fx_view_text: feat.browsers.ff.view.text,
      wpt: feat.wpt,
      wpt_desc: feat.wpt_descr
        ?.substring(0, 200)
        .replaceAll("\r\n", " ")
        .replaceAll("\n", " "),
      interop_compat_risks: feat.interop_compat_risks
        ?.substring(0, 100)
        .replaceAll("\r\n", " ")
        .replaceAll("\n", " "),
      updated: feat.updated.when,
    };
  })
  .sort((a, b) => {
    return a.updated > b.updated ? -1 : 1;
  });
console.log(featureMeta.slice(0, 20));

Deno.writeTextFileSync(
  "./output/chromestatus.csv",
  json_to_csv({
    input: featureMeta,
  })
);
