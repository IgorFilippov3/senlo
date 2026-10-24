// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { UnsubscribeScreen } from "@senlo/next/client";
import { senloPublicAction } from "@/lib/actions";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <UnsubscribeScreen
      token={token}
      call={senloPublicAction}
      footer={<p>&copy; {new Date().getFullYear()} Senlo Email Builder. All rights reserved.</p>}
    />
  );
}
