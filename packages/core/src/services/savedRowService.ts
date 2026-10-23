// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AccessGuard } from "../access";
import type { SavedRow } from "../domain";
import { ValidationError } from "../errors";
import type { IProjectRepository, ISavedRowRepository } from "../ports";

/** Rows a user keeps to reuse across templates; owned by the user, optionally tied to a project. */
export class SavedRowService {
  private readonly access: AccessGuard;

  constructor(
    private readonly savedRows: ISavedRowRepository,
    projects: Pick<IProjectRepository, "findById">,
    access?: AccessGuard,
  ) {
    this.access = access ?? new AccessGuard(projects);
  }

  list(userId: string): Promise<SavedRow[]> {
    return this.savedRows.findByUser(userId);
  }

  async save(
    userId: string,
    input: { name: string; data: unknown; projectId?: number | null },
  ): Promise<SavedRow> {
    const name = input.name?.trim();
    if (!name) throw new ValidationError("Name is required");
    // Saving a row to one's own library: reading the project it came from is enough.
    if (input.projectId) await this.access.requireProject(userId, input.projectId, "read");
    return this.savedRows.create({
      userId,
      projectId: input.projectId || null,
      name,
      data: input.data,
    });
  }

  async delete(userId: string, id: number): Promise<void> {
    this.access.requireUserOwned(userId, await this.savedRows.findById(id), "Saved row");
    await this.savedRows.delete(id);
  }
}
