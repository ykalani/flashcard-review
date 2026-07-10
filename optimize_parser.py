import dspy
import json
import os

key = os.environ.get("GROQ_API_KEY", "")
if not key:
    print("Set GROQ_API_KEY first")
    exit(1)

lm = dspy.LM("groq/llama-3.3-70b-versatile", api_key=key)
dspy.configure(lm=lm)

class Flashcard(dspy.Signature):
    material = dspy.InputField(desc="Raw study material to parse")
    term = dspy.OutputField(desc="The key term or vocabulary word")
    definition = dspy.OutputField(desc="Concise 1-2 sentence definition")

trainset = [
    dspy.Example(material="mitosis | cell division", term="Mitosis", definition="Cell division producing two identical daughter cells").with_inputs("material"),
    dspy.Example(material="photosynthesis - plants convert light", term="Photosynthesis", definition="Process by which plants convert light into chemical energy").with_inputs("material"),
    dspy.Example(material="DNA\tgenetic material", term="DNA", definition="Molecule carrying genetic instructions for all living organisms").with_inputs("material"),
    dspy.Example(material="ribosome: protein synthesis", term="Ribosome", definition="Cellular structure that synthesizes proteins").with_inputs("material"),
    dspy.Example(material="enzyme catalyzes reactions", term="Enzyme", definition="Protein that accelerates biochemical reactions").with_inputs("material"),
]

valset = [
    dspy.Example(material="meiosis -> gamete formation", term="Meiosis", definition="Cell division producing four genetically unique gamete cells").with_inputs("material"),
    dspy.Example(material="ATP energy currency", term="ATP", definition="Adenosine triphosphate, the primary energy carrier in cells").with_inputs("material"),
]

optimizer = dspy.BootstrapFewShot(max_labeled_demos=3)
program = dspy.ChainOfThought(Flashcard)
optimized = optimizer.compile(program, trainset=trainset)

optimized.save("dspy_optimized.json")
print("Saved optimized program to dspy_optimized.json")

test_inputs = [
    "mitochondria powerhouse of the cell",
    "chloroplast converts light to energy in plants",
]
for t in test_inputs:
    r = optimized(material=t)
    print(f"  In: {t}")
    print(f"  Out: {r.term} -- {r.definition}\n")
