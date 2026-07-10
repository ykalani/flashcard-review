import os
import base64
from groq import Groq

GROQ_MODEL = "llama-3.3-70b-versatile"
VISION_MODEL = "llama-3.2-90b-vision-preview"

SYSTEM_PROMPT = """You parse vocabulary or study material into flashcards.
Return ONLY valid JSON — an array of objects with "term" and "definition" keys.
Example:
[
  {"term": "Photosynthesis", "definition": "Process by which plants convert light into chemical energy"},
  {"term": "Mitosis", "definition": "Cell division producing two identical daughter cells"}
]

Rules:
- If the input is a list of terms (one per line), create simple term->definition flashcards.
- If the input has tab/comma-separated pairs, preserve them exactly.
- If the input is a block of text, extract key concepts and their definitions.
- Make definitions concise but complete — 1-2 sentences max.
- Output ONLY the JSON array, no markdown, no commentary."""

def parse_vocab(text, api_key=None):
    key = api_key or os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise ValueError("GROQ_API_KEY not set")

    client = Groq(api_key=key)
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Turn this into flashcards:\n\n{text}"},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    import json
    raw = resp.choices[0].message.content
    data = json.loads(raw)
    if isinstance(data, dict):
        for key in ("flashcards", "cards", "terms", "pairs", "data"):
            if key in data:
                data = data[key]
                break
        if isinstance(data, dict):
            data = [data]
    return data

JUDGE_PROMPT = """You evaluate a student's answer to a flashcard question.

Term: "{term}"
Correct definition: "{definition}"
Student's answer: "{answer}"

Rate the answer 0-3 using these strict criteria:
- **3 (Perfect):** Captures ALL key concepts accurately. Minor wording differences are fine. Synonyms and rephrasing are acceptable as long as every essential point is present.
- **2 (Good):** Captures the main idea but misses minor details or has small inaccuracies. The core concept is there but not fully precise.
- **1 (Weak):** Has some relevant information but misses major key points. Shows partial understanding but significant gaps remain.
- **0 (Wrong):** Completely incorrect, irrelevant, blank, or shows no understanding of the concept.

Think step by step:
1. Identify the essential key points in the correct definition.
2. Check which of these are present in the student's answer.
3. Check for any incorrect information.
4. Assign a score and write 1-2 sentences of reasoning.

Return ONLY valid JSON: {{"quality": 0-3, "reasoning": "..."}}"""

def judge_answer(term, definition, answer, api_key=None):
    key = api_key or os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise ValueError("GROQ_API_KEY not set")
    client = Groq(api_key=key)
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": "You are a fair flashcard grader. Return only JSON."},
            {"role": "user", "content": JUDGE_PROMPT.format(term=term, definition=definition, answer=answer)},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    import json
    raw = resp.choices[0].message.content
    return json.loads(raw)

def parse_image(image_bytes, api_key=None):
    key = api_key or os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise ValueError("GROQ_API_KEY not set")

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_uri = f"data:image/jpeg;base64,{b64}"

    client = Groq(api_key=key)
    resp = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "This image contains a vocabulary list or study material. "
                                "Extract every term-definition pair and return them as a JSON array "
                                'of objects with "term" and "definition" keys. '
                                "If the material uses tables, lists, or paragraphs, "
                                "identify each distinct concept and its explanation. "
                                "Be thorough — capture ALL terms visible in the image. "
                                "Return ONLY valid JSON, no markdown, no commentary.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": data_uri},
                    },
                ],
            },
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    import json
    raw = resp.choices[0].message.content
    data = json.loads(raw)
    if isinstance(data, dict):
        for key in ("flashcards", "cards", "terms", "pairs", "data"):
            if key in data:
                data = data[key]
                break
        if isinstance(data, dict):
            data = [data]
    return data
