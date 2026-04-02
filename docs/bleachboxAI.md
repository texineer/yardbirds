# BleacherBox AI — Research & Roadmap

## Vision

Onsite laptop setup where:
- A camera records/streams the game
- BleacherBox scoring data feeds a live score overlay
- AI enhances the broadcast with player tracking, auto-highlights, and commentary
- Families watch at home via a shareable link

BleacherBox already has the hardest piece: **live game state data**. The broadcast layer builds on top of it.

---

## Layer 1: Livestreaming

| Option | Latency | Cost | Notes |
|---|---|---|---|
| OBS Studio → YouTube Live | 5–20s | Free | Easiest for viewers; shareable link, no app |
| OBS → Ant Media Server (self-hosted) | ~0.5s | Free (OSS) | Sub-second latency, runs on local network |
| Project Lightspeed | <1s | Free (OSS) | Fully self-contained OBS→WebRTC server |

**Recommended starting point:** OBS → YouTube Live. Zero infrastructure, families click a link.

Resources:
- [OBS Studio](https://obsproject.com/)
- [Ant Media Server](https://github.com/ant-media/Ant-Media-Server)
- [Project Lightspeed](https://github.com/GRVYDEV/Project-Lightspeed)

---

## Layer 2: Score Overlay (BleacherBox → OBS)

BleacherBox's live scoring data can feed a scorebug overlay directly into OBS via a **Browser Source**.

### Architecture

```
BleacherBox API (live game state)
  → /overlay route (HTML scorebug page)
  → OBS Browser Source
  → Broadcast
```

### What to build
1. `/overlay` route in BleacherBox — fullscreen transparent HTML scorebug
   - Shows: Score, Inning, Outs, Bases, Team names
   - Reads from existing game state API
2. WebSocket push for real-time updates (no polling delay)
3. OBS setup guide for scorers

### Off-the-shelf OBS scoreboard tools (no build required)
- [ScoreLeader (free OBS plugin)](https://obsproject.com/forum/resources/scoreleader-scoreboard-stream-overlay-and-scorebug.2184/)
- [OBScoreboard](https://obscoreboard.com/) — browser-based, no download
- [Guppyi](https://www.guppyi.com/) — real-time scoreboard with OBS integration

**Custom overlay is preferred** since BleacherBox already has the data — no manual score entry needed.

---

## Layer 3: AI Features

### Player Tracking

- **YOLO / MediaPipe** — detect player positions on field, overlay player IDs
- [Roboflow Sports](https://github.com/roboflow/sports) models work for person detection at field scale
- Use cases: show which fielder caught a ball, visualize base runner positions

### Jersey Number Recognition

- Deep learning OCR on jersey numbers → auto-identify who's at bat or pitching
- Ties directly to BleacherBox lineup data: auto-announce "Now batting: #12 Jones"
- **Hardware option:** [XbotGo Chameleon](https://xbotgo.com/pages/xbotgo-chameleon) has jersey recognition built in
- **DIY:** two-stage detection (person box → crop → OCR) — research-grade but feasible

### Automated Highlight Clips

- **Easiest approach — trigger-based, no CV needed:**
  - Strikeout recorded in BleacherBox → clip last 10s of video
  - Home run recorded → clip last 15s
  - Uses score event timestamps + FFmpeg to extract clips
- **Advanced:** CV excitement detection (crowd noise analysis, motion spikes)
- Tools: FFmpeg, Python, BleacherBox scoring webhook

### AI Play-by-Play Commentary

- BleacherBox already records every pitch and play → send to Claude API
- Claude generates natural language: *"Strike three swinging — Hernandez sits down the side"*
- Can run post-play or post-inning as a ticker or spoken audio
- Text-to-speech options: browser Web Speech API (free), [ElevenLabs](https://elevenlabs.io/) (realistic voices)
- **Highly achievable** — uniquely enabled by BleacherBox's existing pitch-by-pitch data

### Auto-Tracking Camera (Hardware)

- Physical gimbal cameras with AI tracking built in — no software CV required
- [XbotGo Chameleon](https://xbotgo.com/pages/xbotgo-chameleon), [OBSBOT](https://www.obsbot.com/) — plug in as USB camera → straight to OBS
- ~$300–600, significant upgrade for single-operator setup
- Some models support jersey number lock-on for following specific players

### Strike Zone Overlay

- Draw a rectangle representing the strike zone over the pitcher/batter view
- Calibrated once per session (or estimated from batter height)
- Simple CSS/canvas overlay — no ML needed, easy to add to the BleacherBox overlay page

### Post-Game AI Recap

- After game ends, send full scorebook data to Claude API
- Generates: game summary, notable performances, pitch count narrative
- Could be emailed to parents or displayed in the BleacherBox team feed

---

## Realistic On-Site Stack

```
Laptop (on-site at field)
├── Auto-tracking camera (XbotGo/OBSBOT) or webcam on tripod
├── BleacherBox (running, someone scoring the game)
├── OBS Studio
│   ├── Camera source
│   ├── Browser Source → localhost:PORT/overlay  ← BleacherBox scorebug + strike zone
│   └── Stream → YouTube Live
└── (Optional) Python sidecar
    ├── Listens to BleacherBox scoring events
    ├── Triggers FFmpeg highlight clips on key plays
    └── Sends play data to Claude API for commentary
```

---

## Implementation Phases

### Phase 1 — Score Overlay (High value, low effort)
- Add `/overlay` route to BleacherBox client
- Styled scorebug: score, inning, outs, bases, team names
- Reads from existing live game API
- WebSocket for real-time push
- OBS setup documentation

### Phase 2 — Stream Infrastructure

- OBS profile/scene collection for BleacherBox
- Streaming guide for parents/scorers
- Optional: Ant Media Server for low-latency local network streaming

### Phase 3 — AI Enhancements

- AI play-by-play commentary via Claude API (lowest friction — data already exists)
- Automated highlight clip extraction using FFmpeg + BleacherBox scoring webhooks
- Strike zone overlay on the scorebug page
- Player tracking / jersey recognition (Python + YOLO, or hardware camera)

---

## Key Files in BleacherBox (for Phase 1)

- `client/src/pages/` — Add `Overlay.jsx` (the scorebug page)
- `client/src/App.jsx` or router — Add `/overlay` route
- `server/` — Ensure live game state is accessible via API endpoint
- `client/index.html` — May need to support fullscreen/transparent mode for overlay

---

## References

- [Roboflow Sports GitHub](https://github.com/roboflow/sports)
- [XbotGo Chameleon (jersey tracking camera)](https://xbotgo.com/pages/xbotgo-chameleon)
- [OBSBOT Auto-Tracking Camera](https://www.obsbot.com/)
- [Ant Media Server GitHub](https://github.com/ant-media/Ant-Media-Server)
- [Project Lightspeed GitHub](https://github.com/GRVYDEV/Project-Lightspeed)
- [OBScoreboard](https://obscoreboard.com/)
- [ScoreLeader OBS Plugin](https://obsproject.com/forum/resources/scoreleader-scoreboard-stream-overlay-and-scorebug.2184/)
- [Guppyi](https://www.guppyi.com/)
- [ElevenLabs TTS](https://elevenlabs.io/)
- [GetStream AI Sports Analytics](https://getstream.io/blog/ai-sports-analytics/)
- [PlayerTV: Player Tracking & Highlight Clips (research)](https://arxiv.org/html/2407.16076v1)
