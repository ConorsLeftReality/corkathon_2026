#!/usr/bin/env python3
"""
Dialed-In - ring a PJSIP extension and play a WAV when it is answered.

    sudo python3 /opt/dialed-in/call_extension.py <audio.wav> <extension>
    sudo python3 /opt/dialed-in/call_extension.py /tmp/review.wav 1001

Uses an Asterisk call file, so it needs no AMI login. The call lands in the
[autocall] context in infra/asterisk/extensions.conf, which plays ${AUDIOFILE}
and hangs up. Exits 0 when Asterisk reports the call as Completed (answered),
1 when it was not answered or failed, 2 on bad input.
"""
import os
import pwd
import subprocess
import sys
import time

SPOOL = "/var/spool/asterisk/dialed-in/calls"
OUTGOING = "/var/spool/asterisk/outgoing"
DONE = "/var/spool/asterisk/outgoing_done"
FFMPEG = "/usr/bin/ffmpeg"
RING_SECONDS = 30
WAIT_FOR_RESULT_S = 300   # long enough to ring and play a few minutes of audio
KEEP_DAYS = 7


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def tidy(folder):
    """Delete call audio older than KEEP_DAYS."""
    cutoff = time.time() - KEEP_DAYS * 86400
    for name in os.listdir(folder):
        path = os.path.join(folder, name)
        if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
            os.remove(path)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    wav, extension = sys.argv[1], sys.argv[2]
    if not os.path.isfile(wav):
        log(f"no such file: {wav}")
        return 2
    if not extension.isdigit():
        log(f"extension must be digits, got {extension!r}")
        return 2
    if os.geteuid() != 0:
        log("run with sudo (it writes into the Asterisk spool)")
        return 2

    asterisk = pwd.getpwnam("asterisk")
    os.makedirs(SPOOL, exist_ok=True)
    os.chown(SPOOL, asterisk.pw_uid, asterisk.pw_gid)
    tidy(SPOOL)

    name = f"call-{extension}-{int(time.time())}"
    audio = os.path.join(SPOOL, name)
    # asterisk plays 8 kHz mono 16-bit without transcoding
    subprocess.run([FFMPEG, "-loglevel", "error", "-y", "-i", wav,
                    "-ar", "8000", "-ac", "1", "-c:a", "pcm_s16le", audio + ".wav"], check=True)
    os.chown(audio + ".wav", asterisk.pw_uid, asterisk.pw_gid)

    callfile = "\n".join([
        f"Channel: PJSIP/{extension}",
        'CallerID: "Dialed-In" <100>',
        "MaxRetries: 0",
        f"WaitTime: {RING_SECONDS}",
        "Context: autocall",
        "Extension: s",
        "Priority: 1",
        f"Setvar: AUDIOFILE={audio}",
        "Archive: yes",
        "",
    ])
    # written beside the audio, then moved: same filesystem, so asterisk never sees half a file
    staging = os.path.join(SPOOL, name + ".call")
    with open(staging, "w") as f:
        f.write(callfile)
    os.chown(staging, asterisk.pw_uid, asterisk.pw_gid)
    os.replace(staging, os.path.join(OUTGOING, name + ".call"))
    log(f"ringing {extension}")

    done = os.path.join(DONE, name + ".call")
    deadline = time.time() + WAIT_FOR_RESULT_S
    while time.time() < deadline:
        if os.path.exists(done):
            with open(done) as f:
                status = next((line.split(":", 1)[1].strip() for line in f if line.startswith("Status:")), "")
            if status:
                log(f"call status: {status}")
                return 0 if status == "Completed" else 1
        time.sleep(2)
    log("no result from asterisk in time; check: sudo asterisk -rx 'pjsip show contacts'")
    return 1


if __name__ == "__main__":
    sys.exit(main())
