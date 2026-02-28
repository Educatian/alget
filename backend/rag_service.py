import os
import math
import glob
import json
from typing import List, Dict, Any

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

class RAGService:
    """
    Retrieval-Augmented Generation (RAG) Service for ALGET.
    This service will handle embedding academic papers, textbook chapters, 
    and biological datasets, enabling the agents to ground their answers in verifiable literature.
    """
    
    def __init__(self, api_key: str = None):
        """Initialize the RAG service, preparing the embedding models."""
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if GENAI_AVAILABLE and self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.embedding_model = 'gemini-embedding-001'
        else:
            self.client = None
            
        # In-memory vector database
        self.knowledge_base = []
        self._is_loaded = False
        
        print("[RAG Service] Initialized.")

    def load_curriculum(self, content_dir: str):
        """Loads and embeds all .mdx files from the given curriculum directory."""
        if self._is_loaded or not self.client:
            return
            
        print(f"[RAG Service] Indexing curriculum from {content_dir}...")
        
        # We need an absolute path or relative from the backend script execution
        search_pattern = os.path.join(content_dir, '**', '*.mdx')
        mdx_files = glob.glob(search_pattern, recursive=True)
        
        count = 0
        for file_path in mdx_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Basic chunking (if files were large, we'd split them. These MDX are small enough to embed whole)
                doc_id = os.path.basename(file_path)
                self.embed_document(doc_id, content, {"filename": doc_id, "path": file_path})
                count += 1
            except Exception as e:
                print(f"[RAG Service] Failed to register {file_path}: {e}")
                
        self._is_loaded = True
        print(f"[RAG Service] Curriculum loaded ({count} documents embedded).")

    def embed_document(self, doc_id: str, content: str, metadata: dict = None) -> bool:
        """
        Embeds a document text into a vector space and stores it.
        """
        if not self.client:
            print("[RAG Service] Error: Gemini client not initialized. Cannot embed.")
            return False
            
        try:
            print(f"[RAG Service] Embedding document: {doc_id}...")
            # Generate embedding
            response = self.client.models.embed_content(
                model=self.embedding_model,
                contents=content
            )
            vector = response.embeddings[0].values
            
            # Store in local memory
            self.knowledge_base.append({
                "doc_id": doc_id,
                "content": content,
                "metadata": metadata or {},
                "embedding": vector
            })
            return True
        except Exception as e:
            print(f"[RAG Service] Embedding failed for {doc_id}: {e}")
            return False

    def retrieve_context(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Searches the knowledge base for documents most relevant to the query.
        """
        if not self.client:
             print("[RAG Service] Error: Gemini client not initialized. Cannot retrieve.")
             return []
             
        print(f"[RAG Service] Retrieving top {top_k} contexts for query: '{query}'")
        
        if not self.knowledge_base:
            return []
            
        try:
            # Embed the query
            response = self.client.models.embed_content(
                model=self.embedding_model,
                contents=query
            )
            query_vector = response.embeddings[0].values
            
            # Pure python cosine similarity
            def cosine_similarity(v1, v2):
                dot_product = sum(a * b for a, b in zip(v1, v2))
                norm1 = math.sqrt(sum(a * a for a in v1))
                norm2 = math.sqrt(sum(b * b for b in v2))
                if norm1 == 0 or norm2 == 0:
                    return 0.0
                return dot_product / (norm1 * norm2)
                
            # Score each document
            scored_docs = []
            for doc in self.knowledge_base:
                if "embedding" in doc:
                    score = cosine_similarity(query_vector, doc["embedding"])
                    scored_docs.append((score, doc))
            
            # Sort descending by score
            scored_docs.sort(key=lambda x: x[0], reverse=True)
            
            # Return top-k documents
            return [doc for score, doc in scored_docs[:top_k]]
            
        except Exception as e:
            print(f"[RAG Service] Retrieval failed: {e}")
            return []
        
    def generate_grounded_answer(self, query: str, task_prompt: str) -> str:
        """
        Perform the full RAG loop: Retrieve context, inject into prompt, generate answer.
        """
        contexts = self.retrieve_context(query)
        context_str = "\n\n".join([f"Source {i+1}:\n{ctx['content']}" for i, ctx in enumerate(contexts)])
        
        augmented_prompt = f"""
        Use the following retrieved academic and textbook context to answer the user's query.
        
        {task_prompt}
        
        <Retrieved Literature Context>
        {context_str if context_str else "No explicit literature context found."}
        </Retrieved Literature Context>
        
        User Query: {query}
        """
        print("[RAG Service] Generating grounded answer...")
        # Placeholder for actual generation call
        return "Grounded answer placeholder based on RAG."

# Instantiate singleton for global use if needed
rag_service = RAGService()
