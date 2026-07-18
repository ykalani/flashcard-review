import os
import time
from collections import defaultdict
from functools import wraps
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")
if os.environ.get("GROQ_API_KEY"):
    os.environ["GROQ_API_KEY"] = os.environ["GROQ_API_KEY"].strip()
if os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["DATABASE_URL"].strip()

from flask import Flask, request, jsonify, render_template
from models import init_db, create_set, get_sets, get_set, delete_set, add_cards, get_cards, get_due_cards, record_review, get_stats
from groq_client import parse_vocab as parse_vocab_groq, parse_image, judge_answer
from dspy_parser import parse_vocab_dspy, parse_vocab_dspy_optimized

app = Flask(__name__)

_rate_limits = defaultdict(lambda: defaultdict(list))

RATE_LIMITS = {
    "parse":       {"max": 15,  "window": 3600},
    "parse-image": {"max": 5,   "window": 3600},
    "total":       {"max": 200, "window": 86400},
}

def get_client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")

def rate_limit(endpoint_group):
    lim = RATE_LIMITS.get(endpoint_group)
    if not lim:
        return lambda f: f
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            ip = get_client_ip()
            now = time.time()
            total_lim = RATE_LIMITS["total"]
            total_cutoff = now - total_lim["window"]
            _rate_limits[ip]["total"] = [t for t in _rate_limits[ip]["total"] if t > total_cutoff]
            if len(_rate_limits[ip]["total"]) >= total_lim["max"]:
                retry_after = int(total_lim["window"] - (now - _rate_limits[ip]["total"][0]))
                return jsonify({
                    "error": "rate_limit_exceeded",
                    "message": f"Daily limit reached. Try again in {retry_after}s.",
                    "retry_after": retry_after
                }), 429
            cutoff = now - lim["window"]
            _rate_limits[ip][endpoint_group] = [t for t in _rate_limits[ip][endpoint_group] if t > cutoff]
            if len(_rate_limits[ip][endpoint_group]) >= lim["max"]:
                retry_after = int(lim["window"] - (now - _rate_limits[ip][endpoint_group][0]))
                return jsonify({
                    "error": "rate_limit_exceeded",
                    "message": f"Too many requests. Try again in {retry_after}s.",
                    "retry_after": retry_after
                }), 429
            _rate_limits[ip]["total"].append(now)
            _rate_limits[ip][endpoint_group].append(now)
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health")
def health():
    key = os.environ.get("GROQ_API_KEY", "")
    return jsonify({"ok": True, "groq_key_set": bool(key), "groq_key_len": len(key)})

@app.route("/api/sets", methods=["GET"])
def list_sets():
    return jsonify(get_sets())

@app.route("/api/sets", methods=["POST"])
def new_set():
    data = request.get_json()
    title = data.get("title", "Untitled")
    source = data.get("source", "")
    set_id = create_set(title, source)
    return jsonify({"id": set_id}), 201

@app.route("/api/sets/<int:set_id>", methods=["GET"])
def get_set_api(set_id):
    s = get_set(set_id)
    if not s:
        return jsonify({"error": "not found"}), 404
    cards = get_cards(set_id)
    stats = get_stats(set_id)
    s["cards"] = cards
    s["stats"] = stats
    return jsonify(s)

@app.route("/api/sets/<int:set_id>", methods=["DELETE"])
def remove_set(set_id):
    delete_set(set_id)
    return "", 204

@app.route("/api/sets/<int:set_id>/cards", methods=["POST"])
def add_cards_api(set_id):
    data = request.get_json()
    cards = data.get("cards", [])
    add_cards(set_id, cards)
    return jsonify({"count": len(cards)}), 201

@app.route("/api/parse", methods=["POST"])
@rate_limit("parse")
def parse():
    data = request.get_json()
    text = data.get("text", "")
    method = data.get("method", "groq")
    if not text.strip():
        return jsonify({"error": "empty input"}), 400
    try:
        if method == "dspy":
            cards = parse_vocab_dspy(text)
        elif method == "dspy-cot":
            cards = parse_vocab_dspy_optimized(text)
        else:
            cards = parse_vocab_groq(text)
        return jsonify({"cards": cards, "method": method})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/judge", methods=["POST"])
def judge():
    data = request.get_json()
    term = data.get("term", "")
    definition = data.get("definition", "")
    answer = data.get("answer", "")
    if not term or not definition:
        return jsonify({"error": "term and definition required"}), 400
    try:
        result = judge_answer(term, definition, answer)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/parse-image", methods=["POST"])
@rate_limit("parse-image")
def parse_img():
    if "image" not in request.files:
        return jsonify({"error": "no image provided"}), 400
    file = request.files["image"]
    image_bytes = file.read()
    if not image_bytes:
        return jsonify({"error": "empty image"}), 400
    try:
        cards = parse_image(image_bytes)
        return jsonify({"cards": cards})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/sets/<int:set_id>/review", methods=["GET"])
def get_review_cards(set_id):
    cards = get_due_cards(set_id)
    return jsonify(cards)

@app.route("/api/sets/<int:set_id>/review", methods=["POST"])
def submit_review(set_id):
    data = request.get_json()
    card_id = data.get("card_id")
    quality = data.get("quality")
    if card_id is None or quality is None:
        return jsonify({"error": "card_id and quality required"}), 400
    record_review(card_id, quality)
    return jsonify({"ok": True})

@app.route("/api/progress", methods=["POST"])
def save_progress():
    data = request.get_json()
    reviews_data = data.get("reviews", [])
    for r in reviews_data:
        record_review(r["card_id"], r["quality"])
    return jsonify({"ok": True})

init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
