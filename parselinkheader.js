// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

// This is a specialised implementation of a System module loader.

"use strict";

// @ts-nocheck
/* eslint-disable */
let System, __instantiateAsync, __instantiate;

(() => {
  const r = new Map();

  System = {
    register(id, d, f) {
      r.set(id, { d, f, exp: {} });
    },
  };

  async function dI(mid, src) {
    let id = mid.replace(/\.\w+$/i, "");
    if (id.includes("./")) {
      const [o, ...ia] = id.split("/").reverse(),
        [, ...sa] = src.split("/").reverse(),
        oa = [o];
      let s = 0,
        i;
      while ((i = ia.shift())) {
        if (i === "..") s++;
        else if (i === ".") break;
        else oa.push(i);
      }
      if (s < sa.length) oa.push(...sa.slice(s));
      id = oa.reverse().join("/");
    }
    return r.has(id) ? gExpA(id) : import(mid);
  }

  function gC(id, main) {
    return {
      id,
      import: (m) => dI(m, id),
      meta: { url: id, main },
    };
  }

  function gE(exp) {
    return (id, v) => {
      v = typeof id === "string" ? { [id]: v } : id;
      for (const [id, value] of Object.entries(v)) {
        Object.defineProperty(exp, id, {
          value,
          writable: true,
          enumerable: true,
        });
      }
    };
  }

  function rF(main) {
    for (const [id, m] of r.entries()) {
      const { f, exp } = m;
      const { execute: e, setters: s } = f(gE(exp), gC(id, id === main));
      delete m.f;
      m.e = e;
      m.s = s;
    }
  }

  async function gExpA(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](await gExpA(d[i]));
      const r = e();
      if (r) await r;
    }
    return m.exp;
  }

  function gExp(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](gExp(d[i]));
      e();
    }
    return m.exp;
  }

  __instantiateAsync = async (m) => {
    System = __instantiateAsync = __instantiate = undefined;
    rF(m);
    return gExpA(m);
  };

  __instantiate = (m) => {
    System = __instantiateAsync = __instantiate = undefined;
    rF(m);
    return gExp(m);
  };
})();

"use strict";
System.register("src/extractLinks", [], function (exports_1, context_1) {
  "use strict";
  var __moduleName = context_1 && context_1.id;
  /**
     * Splits a string containing one or more Link headers into an array of Link headers.
     * @param header For example: `<https://example.com>; msg1="preconnect" msg2=hello, <https://another-example...`
     * @returns e.g. ["<https://example...", "<https://another..."]
     */
  function extractLinks(header) {
    if (header === "") {
      return [];
    }
    // Break into separate links.
    const linksPattern = /,?\s</gm;
    let links = header.split(linksPattern);
    // The split removes '<' from all but the first link. Add these back.
    links = links.map((link, index) => {
      if (index > 0) {
        return "<" + link;
      }
      return link;
    });
    // ["<https://example...", "<https://another..."]
    return links;
  }
  exports_1("extractLinks", extractLinks);
  return {
    setters: [],
    execute: function () {
    },
  };
});
System.register("src/extractUri", [], function (exports_2, context_2) {
  "use strict";
  var __moduleName = context_2 && context_2.id;
  /**
     * Extracts the uri from a link header.
     * @param header For example: `<https://example.com>; msg1="preconnect" msg2=hello`
     * @returns null or the uri (e.g. "https://example.com")
     */
  function extractUri(header) {
    // Extract uri.
    // The uri is always between '<' '>'
    const uriPattern = /<(.+)>/m;
    const uriMatch = uriPattern.exec(header);
    if (uriMatch === null) {
      return null;
    }
    const uri = uriMatch[1];
    return uri;
  }
  exports_2("extractUri", extractUri);
  return {
    setters: [],
    execute: function () {
    },
  };
});
System.register("src/extractParameters", [], function (exports_3, context_3) {
  "use strict";
  var __moduleName = context_3 && context_3.id;
  /**
     * Extracts parameters from a Link header.
     * @param header For example: `<https://example.com>; msg1="preconnect" msg2=hello`
     * @returns e.g. {msg1: "preconnect", msg2: hello}
     */
  function extractParameters(header) {
    if (header === "") {
      return {};
    }
    // Remove uri.
    const uriPattern = /<(.+)>/m;
    const headerWithoutUri = header.replace(uriPattern, "");
    // Extract parameters.
    const paramPattern = /(\w+)="?(\w+)"?/gm;
    const paramMatches = headerWithoutUri.matchAll(paramPattern);
    let params = {};
    for (let match of paramMatches) {
      const [_, key, value] = match;
      params[key] = value;
    }
    return params;
  }
  exports_3("extractParameters", extractParameters);
  return {
    setters: [],
    execute: function () {
    },
  };
});
System.register(
  "parseLinkHeader",
  ["src/extractLinks", "src/extractUri", "src/extractParameters"],
  function (exports_4, context_4) {
    "use strict";
    var extractLinks_ts_1, extractUri_ts_1, extractParameters_ts_1;
    var __moduleName = context_4 && context_4.id;
    /**
     * Parses out uri and parameters from a **single** Link header string.
     * @param header For example: `<https://example.com>; msg1="preconnect" msg2=hello`
     * @returns e.g. {uri: "https://example.com", msg1: "preconnect", msg2: "hello"},
     */
    function parseOneLinkHeader(header) {
      const uri = extractUri_ts_1.extractUri(header);
      const parameters = extractParameters_ts_1.extractParameters(header);
      return { uri, ...parameters };
    }
    /**
     * Parses a Link header into an array of objects.
     * @param header for example `<https://example.com>; msg1="preconnect" msg2=hello, <https://another-example.com>; msg3=wow`
     * @returns e.g.
     *  [
     *    {uri: "https://example.com", msg1: "preconnect", msg2: "hello"},
     *    {uri: "https://another-example.com", msg3: "wow"}
     *  ]
     */
    function parseLinkHeader(header) {
      if (header === "") {
        return [];
      }
      // Break into separate Link headers.
      const linkHeaders = extractLinks_ts_1.extractLinks(header);
      // Parse each Link header.
      const parsedLinks = linkHeaders.map(parseOneLinkHeader);
      return parsedLinks;
    }
    exports_4("parseLinkHeader", parseLinkHeader);
    return {
      setters: [
        function (extractLinks_ts_1_1) {
          extractLinks_ts_1 = extractLinks_ts_1_1;
        },
        function (extractUri_ts_1_1) {
          extractUri_ts_1 = extractUri_ts_1_1;
        },
        function (extractParameters_ts_1_1) {
          extractParameters_ts_1 = extractParameters_ts_1_1;
        },
      ],
      execute: function () {
      },
    };
  },
);

const __exp = __instantiate("parseLinkHeader");
export const parseLinkHeader = __exp["parseLinkHeader"];
