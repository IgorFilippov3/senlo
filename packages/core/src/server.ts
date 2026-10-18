// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * `@senlo/core/server` - the services, for server code only.
 *
 * The root entry (`@senlo/core`) is imported by client components too, so it
 * stays free of anything Node-only. Services and mail adapters live here;
 * queues, workers and the Redis connection live in `@senlo/core/queue`.
 */
export * from "./services/audienceService";
export * from "./services/authService";
export * from "./services/automationService";
export * from "./services/campaignService";
export * from "./services/emailTemplateService";
export * from "./services/projectService";
export * from "./services/settingsService";
export * from "./services/trackingService";
export * from "./services/triggerService";
export * from "./services/mail";
