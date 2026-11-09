## about this project

This is a chrome extension for open markdown files in the browser.
Basically it is forked from last commit of `md-reader/md-reader` (before it is close sourced), and we start from there.

For more info, read the README file in this repo.

There is also a CLI (`cli/md-export.ts`, run with Bun) that exports a Markdown file to the same standalone HTML as the toolbar Export button, without opening a browser tab. See the README for usage.

## rules

Basically, for common workflow for this project, you should:

- doing whatever user ask you to do like fix a bug or adding a feature
- then you build the project via `pnpm`
- wait user to reload the extension and test it in the browser
- after user confirm it, you update the docs and commit the changes

## local file access (do not regress)

Content scripts injected into `file://` pages have no local file access, and a freshly woken MV3 service worker cannot reliably `fetch()` `file://` either: the first request inside the worker's startup window is rejected with `Not allowed to load local resource`, and the browser keeps that error in the extension error log even though the retried request succeeds.

So every `file://` read (file tree directory listings, file switching, auto refresh polling, inlining local images on export) goes through the hidden extension-origin iframe injected by the content script:

- `src/content/local-file.ts` — content-script side channel (iframe messaging + fallback)
- `src/content/file-fetch-frame.ts` — the actual `fetch()` inside the extension context
- `file-fetch-frame.html` — iframe entry, exposed via `web_accessible_resources` for `file:///*`

Do **not** move these reads back into `src/background/index.ts`. The retry logic there is only a fallback for when the iframe channel is unavailable.
