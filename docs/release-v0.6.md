# SOZO v0.6: SOZO on any website

## Changelog

- **Publishable keys.** A website without a backend embeds the companion with `publishable-key="sozo_pk_…"`. The public key works only from the origins listed for it and only buys a ten-minute, origin-locked session (`POST /api/companion/sessions`). Owners manage keys under **API & developers → Website keys** or at `/api/companion/publishable-keys`.
- **Scanning on demand.** The scanner no longer runs at random or while SOZO researches. It runs when asked: "scan", "scan the route", the robot's **Scan** button, or `companion.scan(target?, question?)`.
  - **In place:** the beam fires straight ahead onto a holographic screen, sweeping top to bottom, then side to side.
  - **On a page:** the robot flies to the target, frames it, sweeps it, reads its visible text (redacted, never images or form fields) and flies home. SOZO answers with that text as `context.scan`.
  - Host pages name areas with `registerTarget(name, element, describe?)` or `data-sozo-target`.
- **Model catalog.** `GET /api/companion/models` lists SOZO's models and engines: space science, rockets and engines, orbital calculations, planetary zones, imagery and voice. Each entry has a status, whether this server can run it, and the endpoint to call. A **Models** section on the landing page shows the same catalog.
- **Choose the model per request.** Chat accepts `provider: "sarvam" | "meta"`.
- **Landing page.**
  - The navbar gains MOMAR (opens www.momar.si), Articles (marked NEW) and Models.
  - Articles list the latest publications first, with this year's marked NEW.
  - The MOMAR prototype section has a Moon/Mars toggle, with six Mars views of Jezero and the globe, and leading figures for each world.

## Migration note for MOMAR

Nothing existing changed. To let SOZO scan MOMAR's views, register the map and route panel on the companion (see "Embedded companion and scanning" in the MOMAR integration prompt). To embed without the backend proxy, use a publishable key for `https://www.momar.si`.
