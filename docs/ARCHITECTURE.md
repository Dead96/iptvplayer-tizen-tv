# Architecture

Plain HTML/CSS/JS, no framework, no build tooling beyond Tizen Studio's own
`build-web`/`package` (see [INSTALLATION.md](INSTALLATION.md)). Everything is
ES2017-ish (`async`/`await`, `fetch`, `class`-free `var`-based objects), chosen
to run on the oldest supported platform (Tizen 4.0, Chromium ~56) without a
transpiler.

## View model

`index.html` contains four `<section class="view">` elements, toggled via a
`.active` class (`App.showView(name)` in `js/app.js`). Only one is visible at
a time:

- `#view-loading` — shown while fetching/parsing a playlist or index
- `#view-settings` — playlist/index URL entry (`js/views/settings.js`)
- `#view-channels` — channel list + playlists switcher (`js/views/channelList.js`)
- `#view-player` — playback (`js/views/player.js`)

Each view's JS module owns a `handleKey(action)` function; `Remote.setHandler(fn)`
(in `js/remote.js`) always points at exactly one active handler, so key
handling never needs to check "which view is active" — the active view already
installed its own handler when it became visible.

Several views layer a secondary state machine **on top of** their base
`handleKey` (checked first, before falling through to normal navigation):
error dialogs, in-player menus, and the playlists-switcher panel all work this
way. See `PlayerView._errorActive`/`_menuState` and
`ChannelListView._panelActive` for the pattern.

## Remote control

Tizen exposes remote keys as plain `keydown` events with numeric `keyCode`s —
this is the **documented, reliable** signal on real hardware (`js/remote.js`).
A fallback mapping on `e.key` exists purely so the UI is also navigable from a
regular keyboard during development in a browser; it's irrelevant on-device.

Extra keys (channel up/down, and previously the colored buttons) need
`tizen.tvinputdevice.registerKey(...)` before they fire. **Note:** many modern
Samsung remotes ("One Remote") have no physical colored buttons at all, so any
feature gated behind Red/Green/Yellow/Blue is unreachable for a chunk of
hardware. This project's in-player menu (quality/debug) is therefore reachable
entirely via Enter + arrows, with color keys kept only as an optional bonus
shortcut for remotes that do have them.

## Playlists: single list vs. JSON index

`App.loadSource(url)` fetches whatever URL is configured and **auto-detects**
its shape:

- valid JSON array of `{name, url}` → treated as a **playlists index**
  (`js/playlistsIndex.js`); the channel list header shows the active list's
  name and a "Liste" button appears to switch lists (persisted via
  `Storage.setActivePlaylistIndex`)
- anything else → treated as a single M3U playlist directly (original
  behavior, header just says "Canali")

This keeps the single-playlist case (and its stored `localStorage` key) fully
backward compatible — no migration needed for existing installs.

## Playback: AVPlay

### Namespace: `webapis`, not `tizen`

Samsung's TV-specific extensions (`avplay`, and others) live under the global
**`webapis`** object, not `tizen`. This is easy to get wrong by analogy with
the standard Tizen Web Device APIs (`tizen.systeminfo`, `tizen.tvinputdevice`,
...) which *do* live under `tizen`. Checking `tizen.avplay` silently evaluates
to `undefined` with no error — the app will just fall back to the (much worse)
plain `<video>` tag and nobody will notice until the video doesn't fill the
screen or drops audio. `PlayerView.init()` feature-detects `webapis.avplay`
explicitly for this reason.

### Making the video plane visible

AVPlay renders to a native video plane that the platform composites **below**
the HTML layer. For it to show through, every ancestor element covering that
area must be non-opaque, all the way up to `<html>`/`<body>` — not just the
specific "video hole" div. A `background` set anywhere in that chain (even a
near-black one that "looks like it should just show a black video") blocks it
entirely. In this project, `html, body` are transparent, and every *other*
view (`#view-settings`, `#view-channels`, `#view-loading`) sets its own opaque
background explicitly so they still render correctly on top.

`webapis.avplay.setDisplayRect(x, y, w, h)` and
`webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN')` are both
required — without the display method call, AVPlay renders the stream at its
*native* resolution anchored top-left instead of scaling it to fill the given
rect.

### Adaptive bitrate can silently drop audio

Some IPTV sources' HLS master playlists offer multiple bitrate variants where
the higher-bitrate rendition uses a different audio encoding than the lower
one. Letting AVPlay auto-switch between them (its default ABR behavior) can
switch video fine but drop audio entirely on the switch, with no error event.

The fix implemented here: `PlayerView._playWithAvplay` fetches the channel's
playlist itself, and if it's an HLS master playlist (`#EXT-X-STREAM-INF`),
parses out the list of variants (`M3uParser.parseVariants`) and opens **one
fixed variant directly** — bypassing AVPlay's own ABR switching entirely. It
defaults to the highest-bitrate variant; the in-player menu lets the user
cycle through the others if a particular one misbehaves on their setup.

### CSS gotchas found on real hardware (not just old — also 2022 models)

- The `inset` shorthand (`inset: 0` instead of `top/right/bottom/left: 0`)
  silently does nothing on this engine: `position: absolute` gets applied but
  the element keeps its default in-flow size/position (renders small, top-left
  corner) instead of stretching to fill its parent. Always use the four
  longhand properties.
- Toggling visibility via the `hidden` attribute conflicts with an author CSS
  rule that also sets `display` on the same element (e.g. `display: flex` for
  centering a spinner) — the show/hide can end up silently not working, or
  working for visibility but not for layout. This project uses an explicit
  `.some-class { display: none; } .some-class.visible { display: flex; }`
  pair everywhere instead of relying on `[hidden]`.
- Non-ASCII "icon" characters (gear `⚙`, vertical ellipsis `⋮`, checkmark `✓`)
  rendered as blank boxes ("tofu") on the older TV's font, and even an inline
  `<svg>` icon didn't render at all on that same hardware. Both icon-only
  buttons in this project were replaced with plain text labels ("Impostazioni",
  "Menu") for guaranteed rendering across both target TVs.

## Certificates and packaging

See [INSTALLATION.md](INSTALLATION.md) for the full story — in short: Tizen
Studio's CLI defaults to an **expired** (since 2012) sample distributor
certificate, and even the up-to-date bundled one only works on the emulator,
not on a retail Samsung TV. Installing on real hardware requires a proper
**Samsung certificate** bound to the TV's DUID, created via Tizen Studio's
Certificate Manager (part of the full IDE, not the base CLI install) with a
free Samsung account.
