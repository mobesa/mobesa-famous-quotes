from __future__ import annotations

import json
import os
import random
from collections import Counter
from pathlib import Path
from typing import Any

from flask import Flask, Response, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "quotes.json"


def load_quotes(path: Path = DATA_PATH) -> list[dict[str, Any]]:
    """Load the dataset of quotes from JSON."""
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


QUOTES: list[dict[str, Any]] = load_quotes()


def filter_quotes(
    quotes: list[dict[str, Any]],
    author: str = "",
    category: str = "",
    query: str = "",
) -> list[dict[str, Any]]:
    """Filter quotes by author (substring), category (exact or substring), and free text query."""
    author_norm = author.strip().lower()
    category_norm = category.strip().lower()
    query_norm = query.strip().lower()

    results = []
    for quote in quotes:
        if author_norm and author_norm not in quote["author"].lower():
            continue
        if category_norm:
            categories_lower = [c.lower() for c in quote.get("categories", [])]
            if category_norm not in categories_lower:
                continue
        if query_norm:
            haystack = (
                f"{quote['text']} {quote['author']} {' '.join(quote.get('categories', []))}".lower()
            )
            if query_norm not in haystack:
                continue
        results.append(quote)
    return results


def create_app() -> Flask:
    app = Flask(__name__)

    @app.after_request
    def set_security_headers(response: Response) -> Response:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:;"
        )
        return response

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.route("/api/meta", methods=["GET"])
    def get_meta():
        author_counts: Counter[str] = Counter()
        category_counts: Counter[str] = Counter()

        for q in QUOTES:
            author_counts[q["author"]] += 1
            for cat in q.get("categories", []):
                category_counts[cat] += 1

        authors = [
            {"name": name, "count": count}
            for name, count in sorted(author_counts.items(), key=lambda x: x[0].lower())
        ]
        categories = [
            {"name": name, "count": count}
            for name, count in sorted(category_counts.items(), key=lambda x: x[0].lower())
        ]

        return jsonify(
            {
                "total_quotes": len(QUOTES),
                "authors": authors,
                "categories": categories,
            }
        )

    @app.route("/api/quotes/random", methods=["GET"])
    def get_random_quote():
        author = request.args.get("author", "")
        category = request.args.get("category", "")
        query = request.args.get("q", "")
        exclude_id = request.args.get("exclude_id", type=int)

        filtered = filter_quotes(QUOTES, author=author, category=category, query=query)
        if not filtered:
            return jsonify({"error": "No quotes found matching your filters."}), 404

        candidates = [q for q in filtered if q["id"] != exclude_id] or filtered
        chosen = random.choice(candidates)
        return jsonify(
            {
                "quote": chosen,
                "matching_count": len(filtered),
            }
        )

    @app.route("/api/quotes", methods=["GET"])
    def get_quotes():
        author = request.args.get("author", "")
        category = request.args.get("category", "")
        query = request.args.get("q", "")

        filtered = filter_quotes(QUOTES, author=author, category=category, query=query)
        return jsonify(
            {
                "count": len(filtered),
                "quotes": filtered,
            }
        )

    return app


app = create_app()

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0").lower() in ("1", "true", "yes")
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=debug_mode)
