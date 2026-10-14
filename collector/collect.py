"""Winnable collector: today's open Devpost hackathons with eligibility, deadlines,
cash prizes, calibrated submission odds and currency rates.

    python collector/collect.py              # full run, writes data/hackathons.json
    python collector/collect.py --no-calib   # reuse data/calibration.json

Devpost answers Python's own HTTP client with 403; curl with a browser user agent
works, so every request goes through curl. Requests are spaced out to stay gentle.
"""
import html
import json
import math
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
API = "https://devpost.com/api/hackathons"
PAUSE = 0.4
WORKERS = 4                 # parallel requests, each spaced by PAUSE: about 2 per second overall
CALIB_TARGET = 150          # finished hackathons with a visible gallery
CALIB_MIN_REG = 30          # smaller events are often private or have hidden galleries
CALIB_MAX_AGE_DAYS = 7      # recompute the calibration weekly

SYMBOLS = [("CHF", "CHF"), ("A$", "AUD"), ("C$", "CAD"), ("CA$", "CAD"), ("HK$", "HKD"), ("S$", "SGD"),
           ("R$", "BRL"), ("€", "EUR"), ("£", "GBP"), ("₹", "INR"), ("¥", "JPY"), ("₩", "KRW"),
           ("₦", "NGN"), ("₱", "PHP"), ("zł", "PLN"), ("$", "USD")]


def get(url, tries=3):
    for i in range(tries):
        r = subprocess.run(["curl", "-s", "-L", "--compressed", "-m", "40", "-A", UA, url], capture_output=True)
        body = r.stdout.decode("utf-8", "replace")
        if r.returncode == 0 and body and "<title>403" not in body[:2000]:
            time.sleep(PAUSE)
            return body
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"fetch failed: {url}")


def api_pages(params):
    out, page = [], 1
    while True:
        d = json.loads(get(f"{API}?{params}&page={page}"))
        hs = d.get("hackathons", [])
        out += hs
        total = d.get("meta", {}).get("total_count", 0)
        if not hs or len(out) >= total:
            return out
        page += 1


def text(fragment):
    t = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def money(fragment):
    """'$<span data-currency-value>1,250</span>' -> (1250.0, 'USD')"""
    m = re.search(r"([^\s<>]{0,4})\s*<span data-currency-value>([\d,.]+)</span>", fragment)
    if not m:
        return None, None
    sym, amount = m.group(1).strip(), float(m.group(2).replace(",", ""))
    for s, code in SYMBOLS:
        if sym.endswith(s):
            return amount, code
    return amount, "USD"


def parse_eligibility(page):
    """Devpost's structured 'Who can participate' list. Every line is classified; a line
    that matches no known pattern but restricts entry is kept as 'restricted' (conservative)."""
    m = re.search(r'<ul id="eligibility-list"[^>]*>(.*?)</ul>', page, re.S)
    items = re.findall(r"<li[^>]*>(.*?)</li>", m.group(1), re.S) if m else []
    el = {"min_age": None, "max_age": None, "students": None, "team_min": None, "professionals_only": False,
          "countries_excluded": [], "countries_only": [], "restricted": [], "raw": []}
    for li in items:
        t = text(li)
        el["raw"].append(t)
        tip = re.search(r'title="([^"]+)"', li)
        countries = [c.strip() for c in html.unescape(tip.group(1)).split(",")] if tip else []
        low = t.lower()
        if a := re.search(r"ages?\s*(\d+)\s*to\s*(\d+)", low):
            el["min_age"], el["max_age"] = int(a.group(1)), int(a.group(2))
        elif a := re.search(r"ages?\s*(\d+)\s*\+", low):
            el["min_age"] = int(a.group(1))
        elif "age of majority" in low:
            el["min_age"] = 18
        elif "high school students" in low:
            el["students"] = "high school"
        elif "college students" in low or low.startswith("students only"):
            el["students"] = "university"
        elif "professionals" in low or "post grad" in low:
            el["professionals_only"] = True
        elif low.startswith("team required"):
            n = re.search(r"(\d+)\s*to\s*(\d+)", low)
            el["team_min"] = int(n.group(1)) if n else 2
        elif "excluding" in low or "excluded" in low and "countr" in low:
            el["countries_excluded"] = countries or [c.strip() for c in t.split("excluding", 1)[-1].split(",")]
        elif low == "us only":
            el["countries_only"] = ["United States"]
        elif "countr" in low and "only" in low or "included" in low:
            el["countries_only"] = countries or [t]
        elif "companies" in low and "excluded" in low:
            pass  # individuals are fine
        elif "all countries" in low and not countries:
            pass
        else:
            el["restricted"].append(t)  # member-only, one university only, invite lists
    return el


MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def parse_period(s):
    """'Aug 31 - Oct 23, 2026', 'Oct 05 - 27, 2026', 'Sep 25, 2026', 'Dec 21, 2026 - Jan 10, 2027' -> (start, end) dates."""
    if not s:
        return None, None
    parts = [p.strip() for p in s.split(" - ")]
    years = re.findall(r"\b(20\d\d)\b", s)
    def one(p, fallback_month=None, year=None):
        m = re.match(r"([A-Za-z]{3})?\s*(\d{1,2})(?:,\s*(\d{4}))?", p)
        if not m:
            return None
        mon = MONTHS.get((m.group(1) or "").lower()) or fallback_month
        return date(int(m.group(3) or year), mon, int(m.group(2))) if mon else None
    try:
        end_year = int(years[-1])
        end = one(parts[-1], None, end_year)
        if len(parts) == 1:
            return end, end
        start_year = int(years[0]) if len(years) > 1 else end_year
        start = one(parts[0], None, start_year)
        if end is None or (end and not re.match(r"[A-Za-z]", parts[-1])):
            end = one(parts[-1], start.month if start else None, end_year)
        if start and end and start > end:
            start = start.replace(year=start.year - 1)
        return start, end
    except (ValueError, IndexError, AttributeError):
        return None, None


NONCASH = re.compile(r"\b(credits?|vouchers?|coupons?|swag|merch\w*|hardware|t-?shirts?|subscriptions?|licen[cs]es?|"
                     r"gift ?cards?|tokens?|cohort|mentorship|internships?|interviews?|tickets?|trips?|devices?|laptops?|"
                     r"phones?|kits?|api|cloud|hosting|pro plan|premium|memberships?|courses?|certificates?|nfts?|points|xp)\b", re.I)
AMOUNT = re.compile(r"(US\$|USD|EUR|INR|CAD|AUD|GBP|CHF|Rs\.?|[$€£₹])\s?(\d[\d,]*(?:\.\d+)?)\s*(k|K)?\b|"
                    r"(\d[\d,]*(?:\.\d+)?)\s*(k|K)?\s*(USD|EUR|INR|CAD|AUD|GBP|CHF|dollars|euros)\b")
CODES = {"US$": "USD", "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "RS": "INR", "RS.": "INR", "DOLLARS": "USD", "EUROS": "EUR"}


def amount_in(s):
    """First money amount written in free text, e.g. '1st Place: $1000' -> (1000.0, 'USD')."""
    m = AMOUNT.search(s or "")
    if not m:
        return None, None
    if m.group(2):
        sym, num, k = m.group(1), m.group(2), m.group(3)
    else:
        num, k, sym = m.group(4), m.group(5), m.group(6)
    cur = CODES.get(sym.upper(), sym.upper())
    value = float(num.replace(",", "")) * (1000 if k else 1)
    return value, cur


def parse_prizes(page):
    prizes = []
    for chunk in re.split(r'<div class="[^"]*\bprize\b[^"]*" id="prize_\d+"', page)[1:]:
        chunk = chunk.split('id="prize_')[0][:4000]
        title = text(re.search(r'<div class="prize-title">(.*?)</h6>', chunk, re.S).group(1)) if 'prize-title' in chunk else "Prize"
        val = re.search(r'<div class="prize-value">(.*?)</div>', chunk, re.S)
        desc = re.search(r'<div class="prize-content">.*?<p>(.*?)</p>', chunk, re.S)
        dtext = text(desc.group(1))[:300] if desc else ""
        vtext = text(val.group(1)) if val else ""
        amount, cur = money(val.group(1)) if val else (None, None)
        cash, inferred = bool(amount) and "in cash" in vtext.lower(), False
        if amount is None:  # organiser wrote the amount into the title or description instead of the prize field
            amount, cur = amount_in(title)
            source = title
            if amount is None:
                amount, cur = amount_in(dtext)
                source = dtext
            if amount:
                cash, inferred = not NONCASH.search(source), True
        note = None
        if cash and not inferred and NONCASH.search(title):
            # Devpost says "in cash", the title says "$5,000 in credits + ...": only the remainder is cash
            t_amount, _ = amount_in(title)
            if t_amount:
                rest = max(0.0, amount - t_amount)
                note = f"Mostly {NONCASH.search(title).group(0).lower()}: {rest:,.0f} of {amount:,.0f} is cash"
                amount, cash = rest, rest > 0
            else:
                note = f"Title mentions {NONCASH.search(title).group(0).lower()}"
        elif cash and NONCASH.search(dtext):
            note = f"Prize text mentions {NONCASH.search(dtext).group(0).lower()}"
        w = re.search(r"(\d+)\s*winners?", text(chunk))
        prizes.append({"title": title, "value": vtext or (f"{cur} {amount:,.0f} (from prize text)" if amount else ""),
                       "desc": dtext, "amount": amount, "currency": cur, "cash": bool(cash), "inferred": inferred,
                       "note": note, "winners": int(w.group(1)) if w else 1})
    return prizes


def parse_dates(page):
    deadline = re.search(r'data-iso-date="([^"]+)"[^>]*>\s*Deadline', page)
    starts = re.search(r'data-iso-date="([^"]+)"[^>]*>\s*(?:Starts|Begins|Opens)', page)
    if not deadline:  # fallback: the first ISO date in the info panel
        deadline = re.search(r'id="time-left"[^>]*datetime="([^"]+)"', page)
    return (deadline.group(1) if deadline else None), (starts.group(1) if starts else None)


def gallery_count(url):
    page = get(url)
    pages = [int(p) for p in re.findall(r"project-gallery\?page=(\d+)", page)]
    last = max(pages) if pages else 1
    if last == 1:
        return len(re.findall(r'class="[^"]*gallery-item', page))
    tail = get(f"{url}?page={last}")
    return (last - 1) * 24 + len(re.findall(r'class="[^"]*gallery-item', tail))


def calibrate():
    """Fit submissions = a * registrants^b on recently ended hackathons."""
    def count(h):
        try:
            return [h["registrations_count"], gallery_count(h["submission_gallery_url"])]
        except Exception as e:  # noqa: BLE001
            print("  gallery failed", h["url"], e, flush=True)
            return None

    points, page = [], 1
    with ThreadPoolExecutor(WORKERS) as pool:
        while len(points) < CALIB_TARGET and page < 60:
            d = json.loads(get(f"{API}?status[]=ended&order_by=recently-added&page={page}"))
            batch = [h for h in d.get("hackathons", [])
                     if (h.get("registrations_count") or 0) >= CALIB_MIN_REG and not h.get("invite_only")]
            for p in pool.map(count, batch):
                if p and p[1] > 0:
                    points.append(p)
            print(f"  calibration {len(points)} (page {page})", flush=True)
            page += 1
    points = points[:CALIB_TARGET]
    xs = [math.log(r) for r, _ in points]
    ys = [math.log(s) for _, s in points]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    a = math.exp(my - b * mx)
    resid = [y - (math.log(a) + b * x) for x, y in zip(xs, ys)]
    sd = math.sqrt(sum(r * r for r in resid) / (len(resid) - 2))
    rates = sorted(s / r for r, s in points)
    return {"a": round(a, 4), "b": round(b, 4), "sd_log": round(sd, 3), "n": len(points),
            "median_rate": round(rates[len(rates) // 2], 3), "computed": date.today().isoformat(),
            "points": points}


def rates():
    try:
        d = json.loads(get("https://api.frankfurter.app/latest?from=USD"))
        return {"USD": 1.0, **{k: round(1 / v, 6) for k, v in d["rates"].items()}, "_date": d.get("date")}
    except Exception as e:  # noqa: BLE001
        print("  rates failed:", e)
        return {"USD": 1.0, "_date": None}


def main():
    DATA.mkdir(exist_ok=True)
    seen_path, calib_path = DATA / "seen.json", DATA / "calibration.json"
    seen = json.loads(seen_path.read_text(encoding="utf-8")) if seen_path.exists() else {}

    print("hackathons", flush=True)
    listing = api_pages("status[]=open&status[]=upcoming")
    print(f"  {len(listing)} open or upcoming", flush=True)

    today = date.today().isoformat()

    def detail(h):
        rec = {
            "id": h["id"], "title": html.unescape(h["title"]).strip(), "url": h["url"],
            "org": h.get("organization_name"), "themes": [t["name"] for t in h.get("themes", [])],
            "location": re.sub(r"\s+,", ",", (h.get("displayed_location") or {}).get("location") or "Online"),
            "registrants": h.get("registrations_count") or 0, "open_state": h.get("open_state"),
            "invite_only": bool(h.get("invite_only")), "thumbnail": h.get("thumbnail_url"),
            "prize_total_listed": money(h.get("prize_amount") or "")[0],
            "first_seen": seen.setdefault(str(h["id"]), today),
        }
        rec["online"] = bool(re.match(r"\s*(online|virtual|remote)\b", rec["location"], re.I))
        try:
            page = get(h["url"])
            rec["eligibility"] = parse_eligibility(page)
            rec["deadline"], rec["starts"] = parse_dates(page)
            p_start, p_end = parse_period(h.get("submission_period_dates"))
            rec["period"] = h.get("submission_period_dates")
            rec["deadline_approx"] = rec["deadline"] is None and p_end is not None
            if rec["deadline"] is None and p_end:
                rec["deadline"] = f"{p_end.isoformat()}T23:59:00Z"  # date only on Devpost until it opens
            if rec["starts"] is None and p_start:
                rec["starts"] = f"{p_start.isoformat()}T00:00:00Z"
            rec["prizes"] = parse_prizes(page)
            rec["details"] = True
        except Exception as e:  # noqa: BLE001
            print("  details failed", h["url"], e, flush=True)
            rec.update(eligibility=None, deadline=None, starts=None, prizes=[], details=False)
        return rec

    with ThreadPoolExecutor(WORKERS) as pool:
        out = list(pool.map(detail, listing))
    print(f"  details done for {len(out)}", flush=True)
    seen_path.write_text(json.dumps(seen, indent=0, sort_keys=True), encoding="utf-8")

    def write(calib):
        doc = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "source": "Devpost public hackathon API and hackathon pages", "rates": fx,
               "calibration": calib, "hackathons": out}
        (DATA / "hackathons.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    fx = rates()
    old = json.loads(calib_path.read_text(encoding="utf-8")) if calib_path.exists() else None
    write(old or {"a": 0.3, "b": 1.0, "n": 0, "sd_log": None, "median_rate": 0.3, "computed": None, "points": []})

    if "--no-calib" in sys.argv and calib_path.exists():
        calib = json.loads(calib_path.read_text(encoding="utf-8"))
    else:
        fresh = old and old.get("computed") and (date.today() - date.fromisoformat(old["computed"])).days < CALIB_MAX_AGE_DAYS
        if fresh:
            calib = old
        else:
            print("calibration", flush=True)
            calib = calibrate()
            calib_path.write_text(json.dumps(calib), encoding="utf-8")
    write(calib)
    ok = sum(1 for r in out if r["deadline"])
    pz = sum(1 for r in out if r["prizes"])
    print(f"done: {len(out)} hackathons, {ok} with deadline, {pz} with prizes, calibration n={calib['n']}", flush=True)


if __name__ == "__main__":
    main()
