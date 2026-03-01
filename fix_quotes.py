import os, glob
import re

content_dir = r'c:\Users\jewoo\Desktop\Research\ALGET\frontend\content'

for root, _, files in os.walk(content_dir):
    for file in files:
        if file.endswith('.mdx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if "options='" in content:
                # Replace options='[...]' with options={`[...]`}
                new_content = re.sub(r"options='(\[.*?\])'", r"options={`\1`}", content, flags=re.DOTALL)
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Fixed {filepath}')
