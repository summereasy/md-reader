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
