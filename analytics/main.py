import csv
import os
from datetime import date
from itertools import islice
from math import isfinite

from fastapi import FastAPI, HTTPException

app = FastAPI(title="GNK Algo Analytics", version="0.1.0")


def read_candles():
    path = os.environ.get("GNK_CANDLES_FILE")
    source = os.environ.get("GNK_CANDLES_SOURCE", "").strip()
    if not path or not source:
        raise HTTPException(503, "Historical market data is not configured")
    try:
        candles = []
        with open(path, encoding="utf-8", newline="") as file:
            for row in islice(csv.DictReader(file), 1001):
                day = date.fromisoformat(row["date"]).isoformat()
                prices = {key: float(row[key]) for key in ("open", "high", "low", "close")}
                if not all(isfinite(value) and value > 0 for value in prices.values()):
                    raise ValueError()
                if not prices["low"] <= min(prices["open"], prices["close"]) <= max(prices["open"], prices["close"]) <= prices["high"]:
                    raise ValueError()
                if candles and day <= candles[-1]["date"]:
                    raise ValueError()
                candles.append({"date": day, **prices})
        if not candles or len(candles) > 1000:
            raise ValueError()
    except (OSError, ValueError, TypeError, KeyError, csv.Error):
        raise HTTPException(503, "Historical market data is unavailable") from None
    return {"symbol": "NIFTY 50", "source": source, "candles": candles[-60:]}


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics"}


@app.get("/ready")
def ready():
    read_candles()
    return {"status": "ready"}


@app.get("/market/candles")
def candles():
    return read_candles()
