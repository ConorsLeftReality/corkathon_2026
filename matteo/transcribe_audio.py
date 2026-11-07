#!/usr/bin/env python3
"""
Filing Radar - phone option 3 (ask a question).

Called by Asterisk:
    /usr/bin/python3 /opt/filing-radar/transcribe_audio.py <input.wav> <output_path>

1. Speech-to-text on the caller's WAV  (SpeechRecognition + Google, like prova.py)
2. Answer from the same CRO report the dashboard uses (report.json from app.py)
3. Text-to-speech (gTTS, fallback piper) -> <output_path>.wav, 8 kHz mono 16-bit
Exit 0 on success; anything else makes Asterisk play "sorry".

Only stdlib is imported at module level, so a missing package is logged
instead of crashing before the log line is written.
"""
import datetime
import difflib
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
import traceback

# ---------------------------------------------------------------- settings
BASE = "/opt/filing-radar"
ENV_FILE = os.path.join(BASE, ".env")
DEFAULTS = {
    "REPORT_PATH": os.path.join(BASE, "report.json"),
    "FFMPEG": "/usr/bin/ffmpeg",
    "PIPER": "/usr/local/bin/piper",
    "PIPER_VOICE": "/opt/piper-voices/en_GB-alan-low.onnx",
    "TTS_ENGINE": "gtts",        # "gtts" (falls back to piper) or "piper"
    "STT_LANG": "en-IE",
    "WINDOW_DAYS": "30",         # only used if a row has no status
}
WATCHDOG_S = 22                  # Asterisk gives up at 25
STT_TIMEOUT_S = 8
GTTS_TIMEOUT_S = 5

T0 = time.time()


def log(*args):
    print(f"[{time.time() - T0:4.1f}s]", *args, flush=True)


def load_env(path=ENV_FILE):
    """Tiny .env reader (no python-dotenv needed). File values override DEFAULTS."""
    cfg = dict(DEFAULTS)
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return cfg


# ------------------------------------------------------- words for speech
ONES = ("zero one two three four five six seven eight nine ten eleven twelve "
        "thirteen fourteen fifteen sixteen seventeen eighteen nineteen").split()
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]


def num_words(n):
    n = int(n)
    if n < 0:
        return "minus " + num_words(-n)
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        rest = n % 100
        return ONES[n // 100] + " hundred" + ("" if rest == 0 else " and " + num_words(rest))
    for div, word in ((10 ** 9, "billion"), (10 ** 6, "million"), (1000, "thousand")):
        if n >= div:
            head = num_words(n // div) + " " + word
            rest = n % div
            if rest == 0:
                return head
            return head + (" and " if rest < 100 else " ") + num_words(rest)


ORD_IRREG = {"one": "first", "two": "second", "three": "third", "five": "fifth",
             "eight": "eighth", "nine": "ninth", "twelve": "twelfth"}


def ordinal_words(n):
    parts = num_words(n).split(" ")
    last = parts[-1]
    if last in ORD_IRREG:
        last = ORD_IRREG[last]
    elif last.endswith("y"):
        last = last[:-1] + "ieth"
    else:
        last += "th"
    parts[-1] = last
    return " ".join(parts)


def digit_words(s):
    return " ".join(ONES[int(c)] for c in s if c.isdigit())


def numbers_to_words(text):
    """Any digits left in the text: short numbers as words, long ones digit by digit."""
    return re.sub(r"\d+", lambda m: digit_words(m.group()) if len(m.group()) >= 5
                  else num_words(m.group()), text)


def date_words(d, today):
    s = f"the {ordinal_words(d.day)} of {d.strftime('%B')}"
    if d.year != today.year:
        s += " " + year_words(d.year)
    return s


def year_words(y):
    if 2000 <= y < 2010:
        return num_words(y)
    return num_words(y // 100) + " " + (num_words(y % 100) if y % 100 >= 10 else "oh " + num_words(y % 100))


SUFFIX = {"LTD": "Limited", "LTD.": "Limited", "LIMITED": "Limited", "DAC": "D A C",
          "PLC": "P L C", "CLG": "C L G", "UC": "Unlimited Company",
          "ULC": "Unlimited Company", "CO": "Company", "CO.": "Company",
          "INC": "Incorporated", "T/A": "trading as", "&": "and"}
SPELL_OUT = {"IT", "AI", "UK", "EU", "USA", "IBM", "HSE", "ESB", "AIB", "BOI", "SME", "PR"}


def speak_name(name):
    """'ACME (IRELAND) LTD' -> 'Acme (Ireland) Limited'."""
    out = []
    for w in str(name).split():
        u = w.upper().strip(",")
        if u in SUFFIX:
            out.append(SUFFIX[u])
        elif u.strip("()") in SPELL_OUT:
            out.append(" ".join(u))
        elif w.isupper() or w.islower():
            out.append(re.sub(r"[A-Za-z]+", lambda m: m.group().capitalize(), w))
        else:
            out.append(w)
    return numbers_to_words(" ".join(out)).replace("(", "").replace(")", "")


def join_names(names):
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def plural(n, word):
    return f"{n} {word}" + ("" if n == 1 else "s")


# ----------------------------------------------------------- CRO report
STATUSES = ("overdue", "due", "ok", "unknown", "dissolved")


def _pick(row, *keys):
    low = {str(k).lower(): v for k, v in row.items()}
    for k in keys:
        v = low.get(k)
        if v not in (None, ""):
            return v
    return None


def _parse_date(v):
    if not v:
        return None
    s = str(v).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _norm_status(s):
    s = str(s or "").lower().replace("_", " ").strip()
    if "overdue" in s or "late" in s:
        return "overdue"
    if "dissolv" in s:
        return "dissolved"
    if s.startswith("due"):
        return "due"
    if s in ("ok", "fine", "good"):
        return "ok"
    if s:
        return "unknown" if "unknown" in s else s
    return None


def load_companies(path, window_days, today):
    with open(path) as f:
        data = json.load(f)

    rows = []
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict):
        for k in ("companies", "rows", "items", "data", "report", "results"):
            if isinstance(data.get(k), list):
                rows = data[k]
                break
        else:  # maybe grouped by status: {"overdue": [...], "due": [...]}
            for k, v in data.items():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    for r in v:
                        r = dict(r)
                        if str(k).lower() in STATUSES:
                            r.setdefault("status", str(k).lower())
                        rows.append(r)

    companies = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        name = _pick(r, "company_name", "name", "company")
        num = _pick(r, "company_num", "company_number", "number", "num", "company_no")
        deadline = _parse_date(_pick(r, "deadline", "due_date", "filing_deadline", "ar_deadline", "due"))
        days_left = (deadline - today).days if deadline else None
        if days_left is None:
            d = _pick(r, "days_left", "days_until", "days_until_due", "days_to_deadline")
            if d is not None:
                days_left = int(float(d))
            else:
                d = _pick(r, "days_overdue")
                if d is not None:
                    days_left = -int(float(d))
        status = _norm_status(_pick(r, "status", "state", "category", "class"))
        if status is None:
            if days_left is None:
                status = "unknown"
            elif days_left < 0:
                status = "overdue"
            elif days_left <= window_days:
                status = "due"
            else:
                status = "ok"
        companies.append({"name": str(name or f"company {num}"),
                          "num": str(num or "").strip(),
                          "status": status, "deadline": deadline, "days_left": days_left})
    if rows and not companies:
        log("WARNING: rows found but none parsed; first row keys:", list(rows[0])[:15])
    return companies


# ------------------------------------------------------- understanding
SPOKEN_DIGITS = {w: str(i) for i, w in enumerate(ONES[:10])}
SPOKEN_DIGITS["oh"] = "0"
NAME_NOISE = {"limited", "ltd", "dac", "plc", "clg", "uc", "ulc", "unlimited", "company",
              "designated", "activity", "the", "of", "and", "co", "inc", "teoranta", "t", "a"}
GENERIC = {"services", "holdings", "group", "ireland", "irish", "property", "properties",
           "management", "solutions", "international", "investments", "consulting",
           "trading", "enterprises", "systems", "technologies", "capital", "dublin", "cork"}


def _words(s):
    return re.findall(r"[a-z0-9]+", s.lower())


def _core(name):
    return [w for w in _words(name) if w not in NAME_NOISE]


def find_company(question, companies):
    q = question.lower()
    # spoken digits -> digits ("one two three four" -> "1234"), then glue "123 456"
    q_dig = " ".join(SPOKEN_DIGITS.get(w, w) for w in _words(q))
    q_dig = re.sub(r"(?<=\d) (?=\d)", "", q_dig)
    for n in re.findall(r"\d{3,8}", q_dig):
        for c in companies:
            if c["num"] and c["num"].lstrip("0") == n.lstrip("0"):
                return c

    q_words = set(_words(q))
    q_joined = " " + " ".join(_words(q)) + " "
    best, best_score = None, 0.0
    for c in companies:
        core = _core(c["name"])
        if not core:
            continue
        phrase = " " + " ".join(core) + " "
        if phrase in q_joined:
            score = 10 + len(core)
        else:
            distinctive = [w for w in core if w not in GENERIC] or core
            hits = sum(1 for w in distinctive
                       if w in q_words or difflib.get_close_matches(w, q_words, n=1, cutoff=0.82))
            if hits == 0:
                continue
            score = hits / len(distinctive)
            if score < 0.6:
                continue
        if score > best_score:
            best, best_score = c, score
    return best


def company_sentence(c, today):
    name = speak_name(c["name"])
    d, dl = c["deadline"], c["days_left"]
    st = c["status"]
    if st == "dissolved":
        return f"{name} has been dissolved, so there's nothing to file."
    if st == "overdue":
        if dl is not None and d:
            return f"{name} is overdue. Its deadline was {date_words(d, today)}, {plural(-dl, 'day')} ago."
        return f"{name} is overdue on its annual return."
    if st == "due":
        if dl == 0:
            return f"{name} is due today."
        if dl == 1:
            return f"{name} is due tomorrow."
        if dl is not None and d:
            return f"{name} is due in {plural(dl, 'day')}, on {date_words(d, today)}."
        return f"{name} is due soon."
    if st == "ok":
        if d:
            return f"{name} is fine. Its next deadline is {date_words(d, today)}."
        return f"{name} is fine, nothing due soon."
    return f"I don't have a filing date for {name} in today's CRO data."


def _sorted(cs):
    return sorted(cs, key=lambda c: c["days_left"] if c["days_left"] is not None else 10 ** 6)


def answer(question, companies, today):
    if not companies:
        return "I couldn't find any tracked companies in today's report."
    q = question.lower()

    c = find_company(question, companies)
    if c:
        return company_sentence(c, today)

    overdue = _sorted([c for c in companies if c["status"] == "overdue"])
    due = _sorted([c for c in companies if c["status"] == "due"])
    dissolved = [c for c in companies if c["status"] == "dissolved"]

    if re.search(r"overdue|late|behind|missed|miss", q):
        if not overdue:
            return "Good news, none of your companies are overdue."
        names = join_names([speak_name(c["name"]) for c in overdue[:3]])
        if len(overdue) == 1:
            return f"One company is overdue: {names}."
        return f"{len(overdue)} companies are overdue. The most overdue are {names}."

    if re.search(r"\bdue\b|soon|coming|upcoming|next|deadline|this week|today|tomorrow", q):
        horizon, label = None, "coming up"
        if "today" in q:
            horizon, label = 0, "due today"
        elif "tomorrow" in q:
            horizon, label = 1, "due by tomorrow"
        elif "week" in q:
            horizon, label = 7, "due this week"
        sel = [c for c in due if horizon is None or (c["days_left"] is not None and c["days_left"] <= horizon)]
        if not sel:
            return f"Nothing is {label}." if horizon is not None else "Nothing is due in the next few weeks."
        first = sel[0]
        lead = f"{plural(len(sel), 'company')} {'is' if len(sel) == 1 else 'are'} {label}."
        lead = lead.replace("companys", "companies")
        nxt = company_sentence(first, today)
        return f"{lead} {nxt}" if len(sel) > 1 else nxt

    if "dissolv" in q:
        if not dissolved:
            return "None of your tracked companies are dissolved."
        return f"{plural(len(dissolved), 'company').replace('companys', 'companies')} dissolved: " \
               f"{join_names([speak_name(c['name']) for c in dissolved[:3]])}."

    # default: summary
    s = (f"You're tracking {len(companies)} companies: {len(overdue)} overdue "
         f"and {len(due)} due soon.")
    if overdue:
        s += f" The most overdue is {speak_name(overdue[0]['name'])}."
    elif due:
        s += f" Next up is {speak_name(due[0]['name'])}."
    return s


# ------------------------------------------------------------ audio I/O
def transcribe(path, lang):
    import speech_recognition as sr          # same library as prova.py
    r = sr.Recognizer()
    r.operation_timeout = STT_TIMEOUT_S
    with sr.AudioFile(path) as source:      # file instead of sr.Microphone()
        audio = r.record(source)
    try:
        return r.recognize_google(audio, language=lang).strip()
    except sr.UnknownValueError:
        return ""


def to_8k(cfg, src, dst):
    subprocess.run([cfg["FFMPEG"], "-y", "-loglevel", "error", "-i", src,
                    "-ar", "8000", "-ac", "1", "-c:a", "pcm_s16le", dst],
                   check=True, timeout=8, capture_output=True)


def tts_gtts(text, mp3):
    from gtts import gTTS                     # same library as prova.py
    try:
        t = gTTS(text=text, lang="en", tld="ie", timeout=GTTS_TIMEOUT_S)
    except TypeError:                         # older gTTS without timeout
        t = gTTS(text=text, lang="en", tld="ie")
    t.save(mp3)


def tts_piper(cfg, text, wav):
    subprocess.run([cfg["PIPER"], "--model", cfg["PIPER_VOICE"], "--output_file", wav],
                   input=text, text=True, check=True, timeout=10, capture_output=True)


def synthesize(cfg, text, out_wav):
    tmpdir = tempfile.mkdtemp(prefix="radar-")
    try:
        if cfg["TTS_ENGINE"].lower() != "piper":
            try:
                mp3 = os.path.join(tmpdir, "tts.mp3")
                tts_gtts(text, mp3)
                to_8k(cfg, mp3, out_wav)
                log("TTS: gtts")
                return
            except Exception as e:
                log(f"gTTS failed ({type(e).__name__}: {e}), falling back to piper")
        raw = os.path.join(tmpdir, "tts.wav")
        tts_piper(cfg, text, raw)
        to_8k(cfg, raw, out_wav)
        log("TTS: piper")
    finally:
        for f in os.listdir(tmpdir):
            os.remove(os.path.join(tmpdir, f))
        os.rmdir(tmpdir)


# ------------------------------------------------------------------ main
def _watchdog(signum, frame):
    log(f"TIMEOUT after {WATCHDOG_S}s, giving up")
    sys.stdout.flush()
    os._exit(3)


def main():
    if len(sys.argv) < 3:
        log("usage: transcribe_audio.py <input.wav> <output_path_without_ext>")
        return 2
    signal.signal(signal.SIGALRM, _watchdog)
    signal.alarm(WATCHDOG_S)

    in_wav, out_wav = sys.argv[1], sys.argv[2] + ".wav"
    cfg = load_env()
    today = datetime.date.today()
    log("---- new question:", in_wav)

    question = transcribe(in_wav, cfg["STT_LANG"])
    log("QUESTION:", repr(question))

    if not question:
        reply = "Sorry, I didn't catch your question. Please try again."
    else:
        try:
            companies = load_companies(cfg["REPORT_PATH"], int(cfg["WINDOW_DAYS"]), today)
            log(f"report: {len(companies)} companies from {cfg['REPORT_PATH']}")
            reply = answer(question, companies, today)
        except (OSError, ValueError) as e:
            log(f"report error: {type(e).__name__}: {e}")
            reply = "Sorry, I can't read today's filing report right now."

    reply = numbers_to_words(reply)
    log("ANSWER:", reply)

    synthesize(cfg, reply, out_wav)
    log("wrote", out_wav, os.path.getsize(out_wav), "bytes")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except BaseException:
        log("FAILED:\n" + traceback.format_exc())
        sys.exit(1)
