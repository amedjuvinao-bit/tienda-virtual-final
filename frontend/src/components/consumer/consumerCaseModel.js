export const CASE_STATUS = {
  received: "Recibida",
  in_review: "En revisión",
  answered: "Respondida",
  closed: "Cerrada",
};
export const caseDate = (value) =>
  new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  });
