# ADR-0010: native camera capture adapter

Status: accepted in C-13-S3-A1

## Context

The Android product shell renders the live Next.js service in a Capacitor
WebView. On the `foodtest` AVD, the HTML file input with `capture="environment"`
was routed to Android Photo Picker instead of opening the device camera. That
made the product button labelled “立即拍照” behave as gallery selection and
left the primary photo-recognition workflow incomplete.

## Decision

Use the official `@capacitor/camera` plugin for native platforms.

- Android invokes `Camera.getPhoto` with `CameraSource.Camera` and
  `CameraResultType.DataUrl`.
- The component converts the returned in-memory Data URL to a `File` and
  reuses the existing validation, `/api/ai/recognize`, review, and `/api/meals`
  save path. No new API, storage owner, or database entity is introduced.
- Browser builds keep the existing file inputs. The HTML camera input remains
  the browser fallback because its native behavior is browser-owned.
- User cancellation stays on the capture surface. Permission or camera errors
  are shown to the user and never become a false recognition success.
- The image is held only for the current recognition request and preview; it
  is not added to SQLite, Agent memory, messages, or logs.

## Consequences

Android now has an explicit host capability boundary for camera capture. The
shell must sync the plugin before building. The recognition contract and its
human review gate remain unchanged, so Web and Android still share one service
and one persistence authority.

## Verification

The amendment is accepted only after an Android build installs on the
`foodtest` AVD, the “立即拍照” button opens the system camera rather than
Photo Picker, a real image reaches the cloud recognition endpoint, and the
reviewed items are saved and read back from the same account.
