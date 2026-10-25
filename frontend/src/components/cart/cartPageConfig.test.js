import { expect, it } from "vitest";
import { buildSafeCartPageConfig, safePath } from "./cartPageConfig";
import { cartEditorFields } from "../../admin/pages/workspace/cartEditorFields";
it("todos los controles tienen un valor en el contrato compartido", () => {
  const config = buildSafeCartPageConfig({});
  for (const field of cartEditorFields.filter(
    (field) => field.scope !== "form",
  ))
    expect(
      field.scope === "config"
        ? config[field.key]
        : config[field.scope][field.key],
      field.key,
    ).not.toBeUndefined();
});
it("conserva extensiones, brillo cero y grosores decimales sin aceptar rutas externas", () => {
  const config = buildSafeCartPageConfig({
    extra: { keep: true },
    presentation: {
      borderWidth: 0.75,
      reflection: 0,
      backgroundImage: "/scene.webp",
    },
    style: { customSetting: 4 },
    modal: { widthPx: 999 },
    continueShoppingPath: "//externo.test",
  });
  expect(config.extra).toEqual({ keep: true });
  expect(config.style.customSetting).toBe(4);
  expect(config.presentation.borderWidth).toBe(0.75);
  expect(config.presentation.reflection).toBe(0);
  expect(config.modal.widthPx).toBe(600);
  expect(config.continueShoppingPath).toBe("/#categorias");
  expect(safePath("/\\externo.test", "/")).toBe("/");
});
it("conserva un color independiente para las divisiones del carrito lateral", () => {
  expect(
    buildSafeCartPageConfig({ style: { cardBorderColor: "#abcdef" } }).modal
      .separatorColor,
  ).toBe("#abcdef");
  expect(
    buildSafeCartPageConfig({ modal: { separatorColor: "#123456" } }).modal
      .separatorColor,
  ).toBe("#123456");
});
