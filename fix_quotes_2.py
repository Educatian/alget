import os, glob
import re

content_dir = r'c:\Users\jewoo\Desktop\Research\ALGET\frontend\content'

# Revert previous bad substitution and apply HTML entity substitution
for root, _, files in os.walk(content_dir):
    for file in files:
        if file.endswith('.mdx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            
            # Find options={`[...]`} and convert back to options='[...]' but fixing inner quotes
            # Note: the regex matches options={`...`}
            def replace_with_entity(match):
                inner_json = match.group(1)
                # Replace any single quotes in the JSON string with &#39;
                safe_json = inner_json.replace("'", "&#39;")
                return f"options='{safe_json}'"
            
            new_content = re.sub(r'options=\{`(\[.*?\])`\}', replace_with_entity, new_content, flags=re.DOTALL)
            
            # Also catch any existing options='[...]' where the outer quote is closed prematurely because of an inner quote
            # Actually, `[.*?\]` won't match correctly if it's already broken. But wait! My previous script already converted them ALL to options={`...`}
            # Let's see if there are any left as options='...'
            # Wait, my previous script only did it if `options='` was found.
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Fixed back: {filepath}')
