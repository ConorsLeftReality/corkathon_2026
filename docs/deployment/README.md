# Deployment

How to stand up the whole of Dialed-In on a fresh Raspberry Pi: the web app, the CRO Tracker API, the phone system and the CRO Tracker phone line. Each step is a script in [`infra/`](../../infra/README.md) plus the few things a script cannot do (flashing the SD card, pairing a handset).

## What runs where

```mermaid
flowchart LR
  GH[GitHub Actions] -->|git push over Tailscale| Dokku
  subgraph Pi[Raspberry Pi 3, Pi OS Lite 64-bit]
    Dokku --> Web[corkathon2026<br/>web + api :9000]
    Dokku --> CRO[cro-tracker<br/>report api :9001]
    Ast[Asterisk 22<br/>10.99.99.1:5060] --> Scripts[/opt/dialed-in<br/>CRO Tracker scripts/]
    Scripts -->|API_TOKEN| CRO
  end
  Pi -->|eth0 10.99.99.0/24| Switch[Netgear GS308E] --> Base[Cisco DBS-110 DECT base<br/>10.99.99.200] -.-> Handset[Handset 1001]
  Pi -->|wlan0| Wifi[Wifi or phone hotspot] --> Net[Internet: CRO download,<br/>Google speech to text]
  Zoiper[Zoiper softphone 1002] -->|Tailscale| Ast
```

## Order

| Step | Doc | Time |
|---|---|---|
| 1 | [Pi base: OS, network, Tailscale, Piper](01-pi.md) | 30 min |
| 2 | [Asterisk: build, config, DECT base, softphone](02-asterisk.md) | 1 to 2 hours, mostly compiling |
| 3 | [Dokku and the two apps](03-dokku-and-apps.md) | 30 min |
| 4 | [CRO Tracker phone line](04-phone.md) | 15 min plus the first pre-render |
| 5 | [GitHub Actions deploys](05-github-actions.md) | 10 min |

Once all five are done, a push to `main` redeploys both apps by itself. The phone scripts and Asterisk config are not deployed by CI: after changing anything in `infra/`, pull on the Pi and rerun the matching script.

## Redeploying an existing Pi

```bash
cd ~/corkathon2026 && git pull
sudo bash infra/asterisk/install.sh      # dialplan changes
sudo bash infra/asterisk/make_prompts.sh # any new prompts
sudo bash infra/phone/deploy.sh          # phone scripts and cron
sudo bash infra/pi/harden.sh             # ssh, firewall, security updates
```

All three are safe to rerun and keep existing passwords, settings and recorded prompts.

## Hardware

- Raspberry Pi 3 (1 GB), 7-inch screen optional
- Cisco IP DECT DBS-110 base station and one handset
- Netgear GS308E 8-port switch (not PoE, so the base needs its own power supply)
- A laptop for the base's web page and SSH, and a phone for the hotspot and Zoiper
