/**
 * Form schemas for the property panel.
 *
 * These used to be a second, hand-written copy of the block schemas in
 * `@senlo/core`, and the two had already drifted: headings allowed levels 1-6
 * in a document but only 1-3 in the form, and an image `src` had to be an
 * absolute URL here, which rejected every file the upload endpoint produces.
 * There is now one schema per block, in the block's definition, and this module
 * only adds the condition field that the form edits alongside the data.
 */
export {
  paddingSchema,
  borderSchema,
  shadowSchema,
  contentConditionSchema,
  conditionOperatorSchema,
  globalSettingsSchema,
  headingBlockFormSchema as headingSchema,
  paragraphBlockFormSchema as paragraphSchema,
  buttonBlockFormSchema as buttonSchema,
  imageBlockFormSchema as imageSchema,
  spacerBlockFormSchema as spacerSchema,
  listBlockFormSchema as listSchema,
  dividerBlockFormSchema as dividerSchema,
  productLineBlockFormSchema as productLineSchema,
  socialsBlockFormSchema as socialsSchema,
  tableBlockFormSchema as tableSchema,
} from "@senlo/core";

import type {
  headingBlockFormSchema,
  paragraphBlockFormSchema,
  buttonBlockFormSchema,
  imageBlockFormSchema,
  spacerBlockFormSchema,
  listBlockFormSchema,
  dividerBlockFormSchema,
  productLineBlockFormSchema,
  socialsBlockFormSchema,
  tableBlockFormSchema,
} from "@senlo/core";

export type BlockSchemas = {
  heading: typeof headingBlockFormSchema;
  paragraph: typeof paragraphBlockFormSchema;
  button: typeof buttonBlockFormSchema;
  image: typeof imageBlockFormSchema;
  spacer: typeof spacerBlockFormSchema;
  list: typeof listBlockFormSchema;
  divider: typeof dividerBlockFormSchema;
  "product-line": typeof productLineBlockFormSchema;
  socials: typeof socialsBlockFormSchema;
  table: typeof tableBlockFormSchema;
};
