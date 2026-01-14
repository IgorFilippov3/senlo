# Senlo Roadmap 🚀

This document outlines the planned features and improvements for the Senlo Email Builder. Our goal is to create the most reliable, developer-friendly, and extensible open-source email platform.

## Planned Features

### Core Infrastructure & Reliability

- [x] **Background Processing with BullMQ**: Migrate email sending to a robust queue system to handle large campaigns, retries, and rate limiting efficiently.
- [ ] **Deliverability Suite**: Implement automatic bounce and complaint handling via provider webhooks (Resend, Mailgun, etc.) to protect sender reputation.
- [ ] **Advanced Analytics**: Detailed tracking of unique vs. total opens, link click-maps, and delivery performance over time.

### API & Developer Experience

- [x] **Public API Expansion**: Enable full management of Audience Lists (create, delete, append contacts) via REST API.
- [x] **Comprehensive API Documentation**: Interactive documentation (Swagger/OpenAPI) for seamless integration with third-party systems.
- [ ] **Webhook Notifications**: Outbound webhooks to notify your system when campaigns are sent, or contacts unsubscribe.

### Email Editor & Personalization

- [ ] **Conditional Content**: Support for `if/else` logic within the editor to show or hide blocks based on contact attributes or tags.
- [ ] **Dark Mode Support**: A complete dark theme for the Dashboard and Editor with a dedicated theme toggle.
- [ ] **Template Gallery**: A library of high-quality, pre-designed templates for common use cases (Welcome, Invoices, Newsletters).

### Marketing & Growth Tools

- [ ] **Visual Automation Builder**: A drag-and-drop workflow editor for automated email sequences (e.g., "Welcome series" or "Abandoned cart").
- [ ] **A/B Testing**: Ability to test different subject lines and content variations to optimize campaign performance.
- [ ] **Segmentation Engine**: Advanced filtering of contacts based on behavior (e.g., "opened last 3 emails") and custom metadata.

### Integrations

- [ ] **Amazon SES Support**: Integration with AWS SES for cost-effective, high-volume email sending.
- [ ] **Autosend Integration**: Native support for Autosend for advanced transactional and marketing workflows.

---

_Note: This list is not exhaustive and priorities may shift based on community feedback and project needs._
