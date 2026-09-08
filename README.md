# IPTVPlayer for Samsung Tizen TV

A Tizen web app for Samsung Smart TVs that plays an IPTV stream from an M3U/M3U8
playlist reachable on your local network — no store, no cloud, just your own TV
and your own playlist.

Built and tested on a Samsung **UE55NU7400** (2018, Tizen 4.0) and a Samsung
**QE75Q70BAT** (2022, Tizen 6.5), with the config targeting Tizen 4.0 as the
minimum supported platform version for broad compatibility.

## Features

- Channel list with a dark, minimal, remote-friendly UI (fast left/right paging)
- Native playback via Samsung's **AVPlay** API (HLS/MPEG-TS), with a fixed-bitrate
  variant selection to avoid an adaptive-bitrate audio bug (see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))
- In-player quality switcher and on-screen debug log
- Multiple named playlists, managed from the TV (add/edit/delete) or
  bulk-imported from a JSON index file (see below)
- Settings persisted locally (playlists, last-active list, last channel)

## Quick start

1. On first launch, **Settings** shows just "+ Aggiungi nuova lista" (Add new
   list). Select it, enter a **name** and the **URL** of an M3U/M3U8 playlist,
   and save.
2. Browse channels, press Enter to play.
3. In the player, use the **Menu** button (Enter → Enter) to switch quality or
   toggle the debug overlay.
4. Add more lists any time from Settings — select an existing one to edit or
   delete it, or add another.

### Multiple playlists without typing on the TV

Typing on a TV remote is slow. Instead of adding playlists one by one on the
TV, host a small JSON file next to your M3U files:

```json
[
  { "name": "Main list", "url": "http://192.168.1.10:8080/playlist.m3u8" },
  { "name": "Sport", "url": "http://192.168.1.10:8080/sport.m3u8" }
]
```

In Settings, add a new list and paste this JSON file's URL (the name field is
ignored in this case). The app detects it's an index rather than a plain M3U
and imports every list in it in one go. To add, rename, or remove lists in
bulk later, edit the JSON file on your computer and re-import it — no TV
typing required for the lists that come from it.

If you don't have anywhere to host a JSON file, any static file host on your
LAN works (a folder shared via a lightweight HTTP server, a NAS, etc.) — it
just needs to serve that one file over HTTP.

A free tip that needs no code at all: the Samsung SmartThings mobile app's
remote includes a phone keyboard that types directly into whatever text field
is focused on the TV — much faster than the on-screen remote-driven keyboard
for one-off entries.

## Project layout

```
config.xml           Tizen widget manifest (privileges, app id)
index.html           All views (loading, settings, channel list, player)
css/style.css         Styling
js/
  app.js              Main controller/router
  storage.js          localStorage persistence
  m3uParser.js         M3U/M3U8 parsing (channels + HLS variant list)
  playlistsIndex.js    JSON playlists-index parsing
  remote.js           Remote control key mapping
  views/
    settings.js       Manage playlists: add/edit/delete, JSON index import
    channelList.js    Channel list + playlists switcher panel
    player.js         AVPlay / fallback <video> playback
scripts/
  build.ps1           Build + sign the .wgt package
  deploy.ps1          Install the package on a TV over the network
docs/
  ARCHITECTURE.md     How the app is built, and the Tizen/AVPlay gotchas found
  INSTALLATION.md     Full setup: Tizen Studio, certificates, sideloading
```

## Building and installing

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for the full setup (Tizen
Studio, certificates, enabling Developer Mode on the TV). Once set up:

```powershell
.\scripts\build.ps1
.\scripts\deploy.ps1 -Tv <tv-ip>
```

Installing on more than one TV just means running `deploy.ps1` again with a
different `-Tv`.

## License

MIT — see [LICENSE](LICENSE).
