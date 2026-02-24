import requests
import json

url = "http://localhost:8000/api/orchestrate"

payload = {
  "query": "Simulate the aerodynamics of a kingfisher beak transitioning into a bullet train design.",
  "grade_level": "Undergraduate",
  "interest": "Aerospace Engineering",
  "history": []
}

print(f"Testing Orchestrator API for Simulation Intent...")

try:
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"Intent detected: {data.get('intent')}")
        
        sim_data = data.get('simulation')
        if sim_data:
            print("Successfully received simulation data!")
            print(f"Description: {sim_data.get('description')}")
            print(f"Concepts Shown: {sim_data.get('concepts_shown')}")
            print(f"HTML Code Preview: {sim_data.get('html_code', '')[:100]}...")
            
            # Save to an HTML file to verify
            with open("test_sim.html", "w", encoding="utf-8") as f:
                f.write(sim_data.get('html_code', ''))
            print("Wrote test_sim.html for manual verification.")
        else:
            print("FAILED to get simulation data. Output:")
            print(json.dumps(data, indent=2))
            
    else:
        print(f"Error {response.status_code}: {response.text}")
        
except Exception as e:
    print(f"Connection failed: {e}")
