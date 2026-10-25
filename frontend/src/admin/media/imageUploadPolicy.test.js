// @vitest-environment node
import { expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
const root = fileURLToPath(new URL("../", import.meta.url));
const tags = new Set([
  "input",
  "Input",
  "TextInput",
  "TextField",
  "DesignText",
  "Text",
]);
const asset =
  /(?:\b|\.)(?:[a-z0-9_]*image(?:Url|Src)?|logo(?:Url|Light|Dark)|tiktokLogo|iconUrl|iconValue|thumb|thumbnail)\b/i;
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name))
        : entry.name.endsWith(".jsx") && !entry.name.includes(".test.")
          ? [path.join(dir, entry.name)]
          : [],
    );
}
it("el panel no ofrece campos de texto para introducir direcciones de imágenes", () => {
  const found = [];
  for (const file of files(root)) {
    const source = fs.readFileSync(file, "utf8"),
      ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
    function walk(node, ancestors = []) {
      if (!node || typeof node !== "object") return;
      if (
        node.type === "JSXElement" &&
        tags.has(node.openingElement.name.name)
      ) {
        const attributes = Object.fromEntries(
          node.openingElement.attributes
            .filter((item) => item.type === "JSXAttribute")
            .map((item) => [item.name.name, item.value]),
        );
        if (
          !["file", "number", "color", "range", "checkbox"].includes(
            attributes.type?.value,
          ) &&
          attributes.onChange
        ) {
          const value = attributes.value
            ? source.slice(attributes.value.start, attributes.value.end)
            : "";
          const owner =
            ancestors
              .filter((item) =>
                ["FunctionDeclaration", "VariableDeclarator"].includes(
                  item.type,
                ),
              )
              .at(-1)?.id?.name || "";
          const label =
            attributes.label?.value || attributes.placeholder?.value || "";
          if (
            asset.test(value) ||
            ([
              "ImageField",
              "imageField",
              "image",
              "UploadField",
              "IconUploadField",
            ].includes(owner) &&
              /\bvalue\b/.test(value)) ||
            /URL.*(?:imagen|[ií]cono)|Enlace de la imagen|Dirección de.*imagen/i.test(
              label,
            )
          )
            found.push(`${path.relative(root, file)}:${node.loc.start.line}`);
        }
      }
      for (const [key, value] of Object.entries(node)) {
        if (["loc", "start", "end", "comments", "tokens"].includes(key))
          continue;
        if (Array.isArray(value))
          value.forEach((item) => walk(item, [...ancestors, node]));
        else if (value && typeof value === "object")
          walk(value, [...ancestors, node]);
      }
    }
    walk(ast);
  }
  expect(found).toEqual([]);
});
