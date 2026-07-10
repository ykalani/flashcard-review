from models import init_db, record_review, get_due_cards, get_stats, create_set, add_cards
init_db()

sid = create_set("SM2 Test", "test")
add_cards(sid, [
    {"term": "Alpha", "definition": "First letter"},
    {"term": "Beta", "definition": "Second letter"},
    {"term": "Gamma", "definition": "Third letter"},
])

record_review(6, 2)
record_review(7, 0)
record_review(8, 3)

print("Stats:", get_stats(sid))
due = get_due_cards(sid)
for c in due:
    print(f"  {c['term']} reps={c['repetitions']} ef={c['ease_factor']:.2f} next={c['next_review']}")
