import os
import sys
import json
from dotenv import load_dotenv

# Load env 
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("GEMINI_API_KEY not found.")
    sys.exit(1)

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)

try:
    with open("frontend/src/pages/GenerativeLab.jsx", "r", encoding="utf-8") as f:
        frontend_code = f.read()
except Exception as e:
    print(f"Failed to read GenerativeLab.jsx: {e}")
    sys.exit(1)

prompt = f"""
You are an expert Illustration Design Agent and Technical UI/UX Artist specializing in Bio-Inspired Design.
The user wants to "polish the UI design" of our newly built Generative Bio-Design Lab.

Here is the current React source code for `GenerativeLab.jsx`:
```jsx
{frontend_code}
```

Please answer:
1. How can you (the Illustration/Design Agent) help polish this UI?
2. What specific Tailwind CSS classes, layouts, or visual elements should we add to make this look "stunning" and truly "premium" for a Generative Bio-Design Lab?

Provide your response in clear Korean so the user understands how we can collaborate, along with actionable English code/Tailwind suggestions.
"""

response = client.models.generate_content(
    model='gemini-2.0-flash',
    contents=prompt,
)

with open("ui_design_recommendations.md", "w", encoding="utf-8") as f:
    f.write(response.text)
print("Recommendations saved to ui_design_recommendations.md")
