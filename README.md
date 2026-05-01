This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment

Copy `.env.example` to `.env.local` and fill in the required values. For
Printful, set `PRINTFUL_API_KEY` to the API token from Printful under
`Settings -> Stores -> API`.

## Future Image Editing Ideas

- Add a mask-based image editor so users can select parts of an uploaded photo
  and ask the AI to change only that area.
- Support common edits like replacing shirt color, changing background, removing
  objects, or adapting a face/reference photo while preserving the rest.
- Evaluate OpenAI image edits or Google Imagen mask editing for this workflow.
- Add a richer voice-message UI with recorded audio playback and a persistent
  waveform preview, similar to WhatsApp voice notes.
- Add a T-shirt mockup workspace as a preview step: render the selected product
  color as the shirt foundation, place the transparent design on top, and let
  users position, scale, and rotate the motif before continuing. Keep the image
  generation prompt focused on an isolated printable motif, not a full shirt
  mockup, so the mockup remains a UI preview and not the production print file.
- Add a team and logo placement mode: detect when users want to upload or create
  a logo for a shirt, show an interactive shirt inside the chat, let users pick
  print zones such as left chest, center chest, back, or sleeves, and store that
  placement as structured order data. For clubs or teams, parse names, numbers,
  sizes, sponsors, and club logos from chat input, generate a reusable team
  template, and create separate personalized variants when names or numbers are
  provided.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
