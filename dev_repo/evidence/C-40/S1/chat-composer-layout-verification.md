# C-40-S1 Chat Composer Layout Verification

- Surface: local Agent workspace at `http://localhost:3100/agent`
- Cases: existing long conversation, desktop default viewport, and 375x812 mobile viewport.
- Result: the message/Trace region is the only scrollable region; the composer is a `shrink-0` sibling below it and remains visible.

## Desktop

- Viewport: 1280x720 (default Browser viewport)
- Message viewport: `scrollHeight=642`, `clientHeight=361`
- Composer: `top=541.9`, `bottom=676.0`, visible inside the viewport
- Document: `scrollHeight=720`, `clientHeight=720`

## Mobile

- Viewport: 375x812
- Message viewport: `scrollHeight=1106`, `clientHeight=461`
- Composer: `top=608.8`, `bottom=734.9`, visible inside the viewport
- `composerVisible=true`; the mobile bottom navigation remains below the chat surface.

## Console

Browser console errors: 0

Browser console warnings: 0

## Screenshots

- `chat-composer-desktop.png`
- `chat-composer-mobile-375.png`
