import requests
import json

url = "http://localhost:8000/api/orchestrate"

payload = {
  "query": "Evaluate my design: I want to make a train purely out of kingfisher feathers to reduce drag.",
  "grade_level": "Undergraduate",
  "interest": "Aerospace Engineering",
  "history": []
}

print(f"Testing Orchestrator API for Evaluation Intent...")

try:
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"Intent detected: {data.get('intent')}")
        
        eval_data = data.get('evaluation')
        if eval_data:
            print("Successfully received evaluation data!")
            print(json.dumps(eval_data, indent=2))
        else:
            print("FAILED to get evaluation data. Output:")
            print(json.dumps(data, indent=2))
            
    else:
        print(f"Error {response.status_code}: {response.text}")
        
except Exception as e:
    print(f"Connection failed: {e}")
