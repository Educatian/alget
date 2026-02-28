import PyPDF2
import os

pdf_dir = r"C:\Users\jewoo\Desktop\Research\ALGET\reading"
for filename in os.listdir(pdf_dir):
    if filename.endswith(".pdf"):
        filepath = os.path.join(pdf_dir, filename)
        try:
            reader = PyPDF2.PdfReader(open(filepath, "rb"))
            text = reader.pages[0].extract_text()
            print(f"--- {filename} ---")
            print(text[:1500])
            print("\n")
        except Exception as e:
            print(f"Failed to read {filename}: {e}")
