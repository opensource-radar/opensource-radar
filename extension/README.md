# OpenSource Radar browser extension

Shows a small panel on any GitHub issue page:

- **How beginner-friendly the project is**: the same signals as on opensource-radar.com (reply time, how many outside pull requests get merged, contributing guide, automatic checks).
- **Still free?**: whether someone is assigned or a pull request is already open.
- **Get help with this issue**: opens Radar's step-by-step help page for it.

The panel can be closed per issue, and stays closed for that issue until the tab is closed.

## Try it in Chrome, Edge or Brave

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this `extension` folder.
4. Open any GitHub issue, for example a "good first issue".

## Package it for the Chrome Web Store

From the repository root:

```bash
cd extension && zip -r ../opensource-radar-extension.zip . -x "README.md"
```

Upload the zip in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Publishing needs a developer account (a one-time fee) and a privacy note; the text below can be used for it.

## Privacy

- On a GitHub issue page, the extension sends the repository name and issue number to `opensource-radar.com` (for the friendliness and issue details) and to `api.github.com` (for linked pull requests).
- It sends no cookies, stores nothing on a server, and keeps only the list of panels you closed, in the tab's session storage.
- It runs only on `github.com` pages and does nothing outside issue pages.

## Files

- `manifest.json`: the extension's settings (Manifest V3).
- `lib.js`: shared helpers (also tested in `tests/extension/lib.test.js`).
- `background.js`: fetches the answers, using the extension's host permissions.
- `content.js`: draws the panel on GitHub issue pages.
