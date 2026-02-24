import requests
import json

url = "http://localhost:8000/api/orchestrate"

payload = {
  "query": "Draw a blueprint for a bullet train nose inspired by a kingfisher beak",
  "grade_level": "Undergraduate",
  "interest": "Aerospace Engineering",
  "history": []
}

print(f"Testing Orchestrator API for Illustration Intent...")

try:
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"Intent detected: {data.get('intent')}")
        
        ill_data = data.get('illustration')
        if ill_data:
            print("Successfully received illustration data!")
            print(f"Title: {ill_data.get('illustration_title')}")
            print(f"Conceptual Design: {ill_data.get('conceptual_design')}")
            print(f"Image Prompt: {ill_data.get('image_prompt')}")
            print(f"UI Elements: {ill_data.get('ui_elements')}")
        else:
            print("FAILED to get illustration data. Output:")
            print(json.dumps(data, indent=2))
            
    else:
        print(f"Error {response.status_code}: {response.text}")
        
except Exception as e:
    print(f"Connection failed: {e}")
