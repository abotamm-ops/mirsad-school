# Shared guardian 3.0.0

Baseline PowerShell was recovered from the gzip payload embedded in the user's verified schools helper 2.1.12. This preserves the minimized-window, tab inventory and global exit shortcut fixes instead of reverting to the older private source.

The common executable embeds that updated script plus a read-only edition/profile selector. It maps the two existing extension IDs to fixed, separate URLs. Only one edition is managed per helper process; running legacy helpers alongside it is rejected without killing processes. If multiple editions/profiles exist, an explicit choice is required. The form shows the chosen edition. Title recognition supports the current distinct school title and the private title.

No extension, backend, account configuration, Chrome preferences or stored attendance is written. The helper reads Chrome Preferences and Secure Preferences to locate enabled extensions, with secure settings taking precedence. It does not register startup, change persistent power policies, or bypass a Windows lock screen. The only GUI changes are the edition choice and identifying subtitle/version; the prior visual design/icon is preserved.

Validation: Go unit tests for embedded file extraction/cleanup and launch argument validation; actual PowerShell tests against synthetic Chrome profile folders, disabled extensions and edition filtering; PowerShell parser on the full script; compiled C# title matcher isolation; minimized-window timer policy and legacy-helper conflict presence; Windows AMD64 GUI cross-build with existing icon resources. No live Windows desktop execution is claimed.

Source is delivered alongside the binary for review and later maintenance. The personal site's scripts, extension and Google service are unchanged.
