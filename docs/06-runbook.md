# Runbook

Setup from zero on the laptop and the Pi. Steps marked **Built** work today; the rest are **Planned** and depend on code that does not exist yet.

## Laptop

### 1. Scaffold (Built)

You need [Bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/getting-started/installation).

```bash
git clone <repo url> corkathon2026
cd corkathon2026
bun install
bun run setup
bun run dev
```

Open http://localhost:5173 and create an account. `bun run check` must pass before anything is pushed.

### 2. Radar dependencies (Planned)

DuckDB and the Anthropic SDK are new dependencies. Ask the team first, then pin exact versions:

```bash
uv add --directory apps/api duckdb==<exact version> anthropic==<exact version>
```

> **VERIFY:** that both packages publish wheels for Python 3.14 (`apps/api/.python-version`) on Windows, macOS and linux arm64.

### 3. Environment (Planned)

Add to `.env` in the repo root (read by `RadarSettings`, which extends the existing pydantic `Settings`):

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
```

| Variable | Default | Used by | Purpose |
|---|---|---|---|
| `JWT_SECRET_KEY` | written by `bun run setup` | API | session signing (**Built**) |
| `ANTHROPIC_API_KEY` | none, required for questions | API, Pi | Claude router |
| `RADAR_MODEL` | `claude-haiku-5-5` | API, Pi | router model |
| `RADAR_DATA_DIR` | `apps/api/data` | all | CSV, DuckDB file, `snapshot.json` |
| `RADAR_AS_OF` | today | all | fixed date for a reproducible demo |
| `RADAR_STALE_DAYS` | `7` | all | freshness gate |
| `RADAR_LLM_TIMEOUT_S` | `8` | API, Pi | Claude timeout |
| `RADAR_PHONE_CLIENTS` | `apps/api/data/demo_clients.csv` | Pi | client list for phone options 1 and briefing |
| `RADAR_AGI_PORT` | `4573` | Pi | FastAGI listen port |
| `RADAR_AUDIO_DIR` | `/srv/radar/audio` | Pi | recordings and replies |
| `PIPER_BIN`, `PIPER_VOICE` | none | Pi | text to speech |
| `WHISPER_BIN`, `WHISPER_MODEL` | none | Pi | speech to text |

`.env` is gitignored. Never commit a key; the API key never reaches the browser.

### 4. Data (Planned)

```bash
bun run radar:fetch
bun run radar:check
bun run radar:demo-clients
```

`radar:check` prints the snapshot date and exits 1 if the data is stale. Add `apps/api/data/` to `.gitignore` when the folder first appears.

### 5. Run

```bash
bun run dev
```

Go to http://localhost:5173/app/radar (Planned).

## Raspberry Pi

Pi OS 64-bit (Bookworm). Join the venue wifi first.

### 1. Base tools

```bash
sudo apt update && sudo apt install -y git sox dnsmasq cmake build-essential
curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in.

### 2. Repo, env and data

```bash
git clone <repo url> ~/corkathon2026
cd ~/corkathon2026
cp .env.example .env
```

Edit `.env`: set `JWT_SECRET_KEY` to the output of `openssl rand -hex 32`, add `ANTHROPIC_API_KEY`, and the Pi variables from the table above.

Copy the laptop's snapshot so both answer from the same data. From the laptop, on the same switch:

```bash
scp apps/api/data/radar.duckdb apps/api/data/snapshot.json apps/api/data/demo_clients.csv pi@10.10.0.1:~/corkathon2026/apps/api/data/
```

If the laptop cannot reach the Pi, fetch on the Pi instead and accept that the snapshot dates may differ by a day:

```bash
uv run --directory apps/api python -m corkathon_api.features.radar.fetch
```

### 3. Phone network, Asterisk, Piper, whisper.cpp

Follow [05-telephony.md](05-telephony.md) in order: Pi network setup, Asterisk in Docker, phone branch, Piper, speech to text.

### 4. FastAGI service

```bash
cd ~/corkathon2026
uv run --directory apps/api python -m corkathon_api.features.radar.phone_agi
```

Keep it in a `tmux` session so it survives an SSH drop:

```bash
tmux new -s radar
```

### 5. Smoke test

```bash
docker compose -f telephony/compose.yml exec asterisk asterisk -rx "pjsip show contacts"
```

`201` should show `Avail`. Then dial `100`, press `1`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Phone stuck on "Registering" | Wrong proxy, user or password; Asterisk not bound to `10.10.0.1`; phone has no address | `cat /var/lib/misc/dnsmasq.leases` to check the phone got an address; `docker compose logs asterisk` for auth failures; `asterisk -rx "pjsip show endpoints"`; recheck the phone's Ext 1 settings |
| Phone gets no address | dnsmasq not on `eth0`, or `radar-lan` connection down | `nmcli con up radar-lan`; `sudo systemctl status dnsmasq`; check the cable goes through the PoE injector's data side |
| No phone power | Injector too weak, or on the wrong port | Use the injector's PoE port for the phone; check the power class |
| Registered, but no audio at all | Codec mismatch or prompts missing | `allow=ulaw,alaw` in `pjsip.conf`; check `telephony/sounds/*.wav` exist at 8 kHz; `asterisk -rx "core show translation"` |
| One-way audio | RTP going to the wrong address | Keep `direct_media=no`, `rtp_symmetric=yes`, `rewrite_contact=yes`; container must use `network_mode: host`; check `rtp.conf` ports are not blocked by a firewall on the Pi |
| Menu plays, option 1 or 2 is silent | FastAGI service not running, or reply path not shared | Is `phone_agi` running on port 4573? Does `/srv/radar/audio/out` exist on the host and in the container? |
| Option 3 always says "sorry" | Speech to text or Claude failing or too slow | Check the `phone_agi` log for the step that timed out; test whisper on a recording by hand; check `ANTHROPIC_API_KEY` and wifi |
| Web says data is stale | CRO file older than `RADAR_STALE_DAYS`, or old local copy | `bun run radar:fetch` then `bun run radar:check`. If the CRO file itself is old, the banner is expected: it is telling users the truth |
| Web answer: "Questions are unavailable right now" (`radar_llm_unavailable`) | Claude API timeout, wrong key, or no internet | Check `.env` and network; use the example question buttons, which run stored filters without Claude |
| `radar_data_missing` | `radar.duckdb` not built | `bun run radar:fetch` |
| Briefing call never rings | Call file not picked up, or wrong channel | `docker compose exec asterisk ls /var/spool/asterisk/outgoing`; `asterisk -rx "pjsip show contacts"`; check the log for `PJSIP/201` |

