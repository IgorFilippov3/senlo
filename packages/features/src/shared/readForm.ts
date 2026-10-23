/**
 * The text fields of a submitted form, by name. For uncontrolled forms that
 * hand their parent typed values: read here, shaped by the dialog, so no
 * caller has to know about `FormData`.
 */
export function readForm(form: HTMLFormElement): Record<string, string> {
  const fields: Record<string, string> = {};
  new FormData(form).forEach((value, name) => {
    if (typeof value === "string") fields[name] = value;
  });
  return fields;
}
