import dspy
import json

lm = None

class Flashcard(dspy.Signature):
    """Extract a single term-definition pair from study material."""
    term = dspy.OutputField(desc="The key term, concept, or vocabulary word")
    definition = dspy.OutputField(desc="A concise 1-2 sentence definition or explanation of the term")

class FlashcardSet(dspy.Signature):
    """Extract all term-definition pairs from the given study material.
    Return every distinct concept you can find. Be thorough.
    Material may be: a list of word pairs, a textbook passage, notes, etc."""
    material = dspy.InputField(desc="Raw study material text to parse into flashcards")
    flashcards = dspy.OutputField(desc="JSON array of objects with 'term' and 'definition' keys")

def ensure_lm():
    global lm
    if lm is None:
        import os
        key = os.environ.get("GROQ_API_KEY", "")
        if key:
            lm = dspy.LM("groq/llama-3.3-70b-versatile", api_key=key)
            dspy.configure(lm=lm)
    return lm is not None

def _parse_output(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        return [raw]
    s = raw.strip()
    try:
        data = json.loads(s)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for k in ("flashcards", "cards", "terms", "pairs", "data", "output"):
                if k in data:
                    v = data[k]
                    return v if isinstance(v, list) else [v]
            return [data]
    except json.JSONDecodeError:
        pass
    result = []
    for line in s.split("\n"):
        line = line.strip().rstrip(",")
        if not line or line.startswith("List of") or line.startswith("```"):
            continue
        for sep in [" — ", " – ", " - ", "\t", " | ", "|", " → ", "->", ": "]:
            if sep in line:
                t, d = line.split(sep, 1)
                result.append({"term": t.strip(), "definition": d.strip()})
                break
        else:
            if line.startswith("- ") or line.startswith("* "):
                result.append({"term": line[2:].strip(), "definition": ""})
    return result

def parse_vocab_dspy(text):
    if not ensure_lm():
        raise ValueError("GROQ_API_KEY not set")
    result = dspy.Predict(FlashcardSet)(material=text)
    return _parse_output(result.flashcards)

def parse_vocab_dspy_optimized(text):
    if not ensure_lm():
        raise ValueError("GROQ_API_KEY not set")
    result = dspy.ChainOfThought(FlashcardSet)(material=text)
    return _parse_output(result.flashcards)
