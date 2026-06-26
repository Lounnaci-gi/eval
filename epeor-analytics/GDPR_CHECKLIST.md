GDPR Checklist for epeor-analytics

- Data minimization: store only necessary personal data.
- Consent: show consent banner before any non-essential tracking.
- Right to access: provide endpoint to export user's data (JSON/CSV).
- Right to delete: provide endpoint to delete user's account and personal data.
- Retention policy: document how long PII is stored and schedule deletion.
- Logging: avoid logging PII (emails, SSNs, full IPs). Log only hashed identifiers.
- Data encryption: use bcrypt for passwords, AES-256 for sensitive fields if required.
- Processors: keep list of third-party processors and Data Processing Agreements.
- Breach plan: procedure and contact details for data breach notifications.

Suggested endpoints:
- POST /api/user/export -> authenticated, returns ZIP/JSON of user data
- POST /api/user/delete -> authenticated, performs deletion/soft-delete workflow

