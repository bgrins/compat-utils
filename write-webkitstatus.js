import { json_to_csv } from "./deps.js";

// Data for https://webkit.org/status/ & https://webkit.org/css-status/#
import WebCore from "https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/features.json" assert { type: "json" };
import JavaScriptCore from "https://raw.githubusercontent.com/WebKit/WebKit/main/Source/JavaScriptCore/features.json" assert { type: "json" };
import CSSProperties from "https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/css/CSSProperties.json" assert { type: "json" };

let webcore_features = WebCore.features.map((f) => {
  return {
    name: f.name,
    status: f.status.status,
    category: f.category,
  };
});

let javascriptcore_features = JavaScriptCore.features.map((f) => {
  return { name: f.name, status: f.status.status, category: f.category };
});

let webkit_css_properties = [];
for (let name in CSSProperties.properties) {
  let property = CSSProperties.properties[name];
  if (!property.status) {
    continue;
  }
  webkit_css_properties.push({
    name: name,
    // Can be string or object
    status: property.status?.status || property.status,
    specification: property?.specification?.category,
  });
}

Deno.writeTextFileSync(
  "./output/webkit_webcore_features.csv",
  json_to_csv({
    input: webcore_features,
  })
);
Deno.writeTextFileSync(
  "./output/webkit_javascriptcore_features.csv",
  json_to_csv({
    input: javascriptcore_features,
  })
);
Deno.writeTextFileSync(
  "./output/webkit_css_properties.csv",
  json_to_csv({
    input: webkit_css_properties,
  })
);

// json_to_csv()
