// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmailDesignDocument } from "@senlo/core";

export interface StarterTemplate {
  name: string;
  subject: string;
  preheader: string;
  design: EmailDesignDocument;
}
