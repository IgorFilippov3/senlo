// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StarterTemplate } from "./types";
import { WELCOME_TEMPLATE } from "./welcome";
import { VERIFY_LOGIN_TEMPLATE } from "./verify-login";
import { MAGIC_LINK_TEMPLATE } from "./magic-link";
import { RESET_PASSWORD_TEMPLATE } from "./reset-password";
import { INVOICE_TEMPLATE } from "./invoice";
import { SHIPPING_UPDATE_TEMPLATE } from "./shipping-update";
import { USAGE_REPORT_TEMPLATE } from "./usage-report";

export type { StarterTemplate } from "./types";

/**
 * Templates every new account starts with, in the order they are created.
 * Static content under the Acme brand: no merge tags yet, so each one opens
 * and previews the same way for everyone.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  WELCOME_TEMPLATE,
  VERIFY_LOGIN_TEMPLATE,
  MAGIC_LINK_TEMPLATE,
  RESET_PASSWORD_TEMPLATE,
  INVOICE_TEMPLATE,
  SHIPPING_UPDATE_TEMPLATE,
  USAGE_REPORT_TEMPLATE,
];
