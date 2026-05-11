#!/usr/bin/env python3
"""
MindHaven · AI Insight Generator

Generates a calming, evidence-informed mental wellness article using the
Lovable AI Gateway (Gemini) and inserts it directly into the `insights`
table in Supabase. Designed to be run locally by an admin, e.g.:

    LOVABLE_API_KEY=...  \
    SUPABASE_URL=...     \
    SUPABASE_SERVICE_ROLE_KEY=...  \
    python scripts/python/generate_insight.py "managing morning anxiety"

Requires: pip install requests
"""
from __future__ import annotations

import json
import os
import sys
import textwrap
import requests

GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"
MODEL = os.environ.get("LOVABLE_MODEL", "google/gemini-3-flash-preview")

SYSTEM_PROMPT = textwrap.dedent(
    """
    You write short, calming, evidence-informed mental wellness articles for an
    app called MindHaven. Tone: warm, grounded, gentle. Never diagnose. Never
    prescribe medication. Always respond with STRICT JSON matching:

    { "title": str, "category": str, "preview": str, "content": str }

    - title: <= 60 characters
    - category: one of "Wellness", "Mental Health", "Self-Care", "Growth"
    - preview: 1-2 sentence hook, <= 200 characters
    - content: 250-400 words, may use plain "•" bullet lines and \\n line breaks
    """
).strip()


def generate(topic: str) -> dict:
    api_key = os.environ.get("LOVABLE_API_KEY")
    if not api_key:
        sys.exit("LOVABLE_API_KEY is not set")

    resp = requests.post(
        GATEWAY_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Write an article about: {topic}"},
            ],
        },
        timeout=60,
    )
    if resp.status_code == 429:
        sys.exit("Rate limited — try again in a moment.")
    if resp.status_code == 402:
        sys.exit("AI Gateway credits exhausted. Add credits in Lovable settings.")
    resp.raise_for_status()
    raw = resp.json()["choices"][0]["message"]["content"]
    return json.loads(raw)


def insert(article: dict) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("\n[dry-run] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.")
        print(json.dumps(article, indent=2))
        return

    r = requests.post(
        f"{url}/rest/v1/insights",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=article,
        timeout=30,
    )
    r.raise_for_status()
    print(f"✓ Inserted insight: {article['title']}")


if __name__ == "__main__":
    topic = " ".join(sys.argv[1:]).strip() or "small daily habits for calmer mornings"
    print(f"→ Generating insight on: {topic}")
    article = generate(topic)
    insert(article)