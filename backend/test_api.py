import os
from dotenv import load_dotenv
load_dotenv(override=True)

try:
    from google import genai
    from google.genai.errors import ClientError

    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    print(f"API KEY Found: {'Yes' if api_key else 'No'}")

    client = genai.Client(api_key=api_key)
    
    print("Testing embed_content with text-embedding-004...")
    try:
        response = client.models.embed_content(
            model='text-embedding-004',
            contents='test'
        )
        print("SUCCESS text-embedding-004: ", len(response.embeddings[0].values))
    except ClientError as e:
        print(f"FAILED text-embedding-004: {e}")

    print("Testing embed_content with gemini-embedding-001...")
    try:
        response = client.models.embed_content(
            model='gemini-embedding-001',
            contents='test'
        )
        print("SUCCESS gemini-embedding-001: ", len(response.embeddings[0].values))
    except ClientError as e:
        print(f"FAILED gemini-embedding-001: {e}")

except Exception as e:
    print(f"OTHER ERROR: {e}")
