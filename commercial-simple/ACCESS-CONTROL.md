# Owner access control (service 2.9.34)

- `commercialOwnerAccessControl` requires an authenticated owner session and is serialized by the existing Apps Script mutation lock.
- `blockAll` disables every non-deleted school and closes automatic registration in the same registry update. It preserves school IDs, credentials/PIN hashes, recorder bindings, sessions, subscription dates, folder IDs and Drive files.
- Existing server authorization rejects disabled school requests; recorder-status still returns the inactive state so existing clients can pause and display the subscription notice.
- Use the existing per-school `renew` operation with explicit payment confirmation to enable only that school for a calendar month. Registration remains closed until the owner explicitly opens it. Opening registration does not enable existing blocked accounts.
- Automatic registration is checked at both code issuance and code redemption. Existing accounts continue to use the ordinary account and payment rules.
- An offline or altered browser cannot be remotely erased. Blocking denies authenticated service access; it does not remove downloaded files or conceal client-side source.

Deploy the encrypted owner 2.9.34 script to the current Apps Script deployment; keep its URL and project properties. Customer extension changes are not required. Owner buttons stay disabled on older services. Do not click block-all during installation unless blocking customers is intended.

- `restoreAll` undoes bulk blocking only; it preserves pre-existing individual blocks, later individual decisions and subscription expiry. Registration stays separately controlled. Repeated undo is safe.
- Owner can save a payment notice with their chosen amount; it is displayed to blocked school accounts. Payment remains manually confirmed; this is not a bank integration or transaction ledger.
