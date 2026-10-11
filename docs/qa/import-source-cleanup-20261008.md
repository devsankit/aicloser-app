# Import source cleanup verification

- Release commit: 3ad2725.
- Source cards remain the single source selector in Lead Import; Contacts Hub retains its drawer selector.
- Paste input starts empty. Example format is a placeholder, not importable sample data.
- Changing source, pasted input, file, or Google Sheet URL invalidates the previous preview.
- Local TypeScript check passed.
- Local automated suite: 63 passed. Production checkout suite: 62 passed (local Meta WIP test is not deployed).
- Live production build/deployment is tracked by shell session 31454; compilation succeeded, final build/reload pending at report creation.
- Fresh signup requires human password entry and an unused phone number; not yet verified.
- CSV preview previously showed two phone-only QA rows as valid without email. Commit and real file-picker Excel upload remain pending; preview alone is not counted as import success.
- End-to-end calls, genuine audio playback, WhatsApp inbound messages, distribution, and mobile replies remain unproven. This report does not close the broader goal.
