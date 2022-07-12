import { writeCSV } from "https://deno.land/x/csv/mod.ts";
import bcd from "https://unpkg.com/@mdn/browser-compat-data@latest/data.json" assert { type: "json" };
/*

/* From: https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md#where-to-find-compat-data
api/ contains data for each Web API interface.
css/ contains data for CSS properties, selectors, and at-rules.
html/ contains data for HTML elements, attributes, and global attributes.
http/ contains data for HTTP headers, statuses, and methods.
javascript/ contains data for JavaScript built-in Objects, statement, operators, and other ECMAScript language features.
mathml/ contains data for MathML elements, attributes, and global attributes.
svg/ contains data for SVG elements, attributes, and global attributes.
*/

let csv = [
  [
    "name",
    "mdn_url",
    "firefox_version_added",
    "firefox_flags",
    "chrome_version_added",
    "chrome_flags",
    "safari_version_added",
    "safari_flags",
    "status_experimental",
    "status_standard_track",
    "status_deprecated",
    "spec_url",
    "org",
  ],
];

function specURLToOrg(url) {
  let host;
  try {
    host = new URL(url).host;
  } catch (e) {}

  if (!host) {
    return "NONE";
  }
  // https://github.com/mozilla/standards-positions/blob/7c37c736fe79fd139aab6048826a7bf6d01c31e5/activities.py#L539
  var mapping = {
    "www.w3.org": "W3C",
    "w3c.github.io": "W3C",
    "wicg.github.io": "W3CCG",
    "webbluetoothcg.github.io": "W3CCG",
    "privacycg.github.io": "W3CCG",
    "dev.w3.org": "W3C",
    "dvcs.w3.org": "W3C",
    "drafts.csswg.org": "W3C",
    "drafts.css-houdini.org": "W3C",
    "drafts.fxtf.org": "W3C",
    "w3ctag.github.io": "W3C",
    "immersive-web.github.io": "W3CCG",
    "datatracker.ietf.org": "IETF",
    "www.ietf.org": "IETF",
    "tools.ietf.org": "IETF",
    "http2.github.io": "IETF",
    "httpwg.github.io": "IETF",
    "httpwg.org": "IETF",
  };
  if (mapping[host]) {
    return mapping[host];
  }

  if (host.endsWith(".spec.whatwg.org")) {
    return "WHATWG";
  }

  return "UNKNOWN";
}

function apiToCSV(api, name) {
  if (!api.__compat) {
    // Parent without its own data - recurse: https://github.com/mdn/browser-compat-data/blob/97aa0a45ee1cb3eae1d89ca998da76c5df0b1380/css/properties/align-self.json
    for (let child in api) {
      if (child == "__compat") {
        continue;
      }
      apiToCSV(api[child], name + "/" + child);
    }

    return;
  }

  let compat = api.__compat;
  let { support, spec_url } = compat;
  let firefox = Array.isArray(support.firefox)
    ? support.firefox[0]
    : support.firefox;

  let chrome = Array.isArray(support.chrome)
    ? support.chrome[0]
    : support.chrome;
  let safari = Array.isArray(support.safari)
    ? support.safari[0]
    : support.safari;

  let mdn_url = (compat.mdn_url || "").replace(
    "https://developer.mozilla.org/docs",
    "https://developer.mozilla.org/en-US/docs"
  );
  // Avoid error in sheets with maximum size exceeded
  mdn_url = "";

  csv.push([
    name,
    mdn_url,
    firefox.version_added || "",
    JSON.stringify(firefox.flags) || "",
    chrome.version_added || "",
    JSON.stringify(chrome.flags) || "",
    safari.version_added || "",
    JSON.stringify(safari.flags) || "",
    compat.status.experimental,
    compat.status.standard_track,
    compat.status.deprecated,
    spec_url || "",
    specURLToOrg(spec_url),
  ]);

  for (let child in api) {
    if (child == "__compat") {
      continue;
    }
    apiToCSV(api[child], name + "/" + child);
  }
}

for (let api in bcd.api) {
  apiToCSV(bcd.api[api], "api/" + api);
}
for (let api in bcd.css) {
  apiToCSV(bcd.css[api], "css/" + api);
}
for (let api in bcd.html) {
  apiToCSV(bcd.html[api], "html/" + api);
}
for (let api in bcd.javascript) {
  apiToCSV(bcd.javascript[api], "javascript/" + api);
}
for (let api in bcd.svg) {
  apiToCSV(bcd.svg[api], "svg/" + api);
}

const latestSupport = await Deno.open("./output/mdn.csv", {
  write: true,
  create: true,
  truncate: true,
});

await writeCSV(latestSupport, csv);
