import features from "https://chromestatus.com/features_v2.json" assert { type: "json" };
import { json_to_csv } from "./deps.js";

let allTags = new Map();
features.forEach((f) =>
  f.tags?.forEach((t) => allTags.set(t, (allTags.get(t) || 0) + 1))
);
allTags = new Map([...allTags.entries()].sort((a, b) => b[1] - a[1]));

console.log("Tags -> ", allTags);

function summarizeString(str, len = 100) {
  return str
    ?.substring(0, len)
    .replaceAll("\r\n", " ")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ");
}

let featureMeta = features
  .filter((feat) => !feat.deleted)
  .map((feat) => {
    return {
      id: feat.id,
      url: `https://chromestatus.com/feature/${feat.id}`,
      name: feat.name,
      summary: summarizeString(feat.summary),
      standards_spec: feat.standards.spec,
      standards_maturity: feat.standards.maturity.short_text,
      fx_view_url: feat.browsers.ff.view.url,
      fx_view_text: feat.browsers.ff.view.text,
      wpt: feat.wpt,
      wpt_desc: summarizeString(feat.wpt_descr),
      interop_compat_risks: summarizeString(feat.interop_compat_risks),
      updated: feat.updated.when,
      created: feat.created.when,
      creator: feat.creator,
      category: feat.category,
      intent_stage: feat.intent_stage,
      blink_component: feat.browsers.chrome.blink_components[0],
      bug: feat.browsers.chrome.bug,
      status_text: feat.browsers.chrome.status.text,
      tag_review: summarizeString(feat.tag_review),
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
