# pdfandme

**Better than Adobe — and actually free.**

A minimal, privacy-first PDF editor that runs entirely in your browser. Your file never leaves the tab — there is no server to send it to.

## Features

- Fill PDF forms (auto-detected fields)
- Insert text boxes
- Draw and place your signature (remembered on your device only)
- Highlight, scribble, whiteout
- Stamps: check, cross, date
- Insert images
- Page operations: rotate, delete, reorder
- Download flattened or with editable form fields

## Stack

- React + Vite + TypeScript
- [pdf.js](https://mozilla.github.io/pdf.js/) for rendering
- [pdf-lib](https://pdf-lib.js.org/) for editing/export
- Deployed on Cloudflare Workers (static assets only — no backend)

## Develop

```sh
npm install
npm run dev
```

## Deploy

```sh
npm run deploy
```

Design mockups live in [`design/mockups.html`](design/mockups.html).
