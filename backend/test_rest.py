import urllib.request
import json
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv('SUPABASE_URL') + '/rest/v1/mastery'
key = os.getenv('SUPABASE_KEY')

print("URL:", url);

req = urllib.request.Request(url, headers={
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json'
})

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print('Failed:', str(e))
