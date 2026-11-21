import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import useHelpNavigation from "./useHelpNavigation";
const routing = vi.hoisted(() => ({
  search: "",
  key: "initial",
  navigation: "POP",
  writes: [],
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ search: routing.search, key: routing.key, state: {} }),
  useNavigationType: () => routing.navigation,
  useSearchParams: () => [
    new URLSearchParams(routing.search),
    (update, options) => {
      routing.writes.push({
        search: "?" + update(new URLSearchParams(routing.search)).toString(),
        navigation: options.replace ? "REPLACE" : "PUSH",
      });
    },
  ],
}));
beforeEach(() => {
  routing.search = "?origen=pie";
  routing.key = "initial";
  routing.navigation = "POP";
  routing.writes = [];
});
afterEach(cleanup);
function Harness() {
  const navigation = useHelpNavigation(true);
  return (
    <>
      <input
        aria-label="Consulta"
        value={navigation.query}
        onChange={(event) => navigation.setSearch(event.target.value)}
      />
      <button onClick={navigation.clearSearch}>Limpiar</button>
      <output>{navigation.query}</output>
    </>
  );
}
function commit(view, write) {
  routing.search = write.search;
  routing.navigation = write.navigation;
  routing.key += "-next";
  view.rerender(<Harness />);
}
it("keeps fast typing and clearing immediate while the router commits older transitions", () => {
  const view = render(<Harness />),
    input = screen.getByLabelText("Consulta");
  fireEvent.change(input, { target: { value: "e" } });
  fireEvent.change(input, { target: { value: "en" } });
  expect(input).toHaveValue("en");
  commit(view, routing.writes[0]);
  expect(input).toHaveValue("en");
  fireEvent.change(input, { target: { value: "envio" } });
  commit(view, routing.writes[1]);
  expect(input).toHaveValue("envio");
  fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
  expect(input).toHaveValue("");
  commit(view, routing.writes[2]);
  expect(input).toHaveValue("");
  commit(view, routing.writes[3]);
  expect(input).toHaveValue("");
  expect(new URLSearchParams(routing.search).get("origen")).toBe("pie");
});
it("synchronizes the input with Back/Forward and externally supplied queries", () => {
  const view = render(<Harness />),
    input = screen.getByLabelText("Consulta");
  fireEvent.change(input, { target: { value: "actual" } });
  commit(view, routing.writes[0]);
  commit(view, { search: "?q=anterior", navigation: "POP" });
  expect(input).toHaveValue("anterior");
  commit(view, { search: "?q=consulta-externa", navigation: "PUSH" });
  expect(input).toHaveValue("consulta-externa");
});
