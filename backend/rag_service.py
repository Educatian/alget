"""Retrieval-Augmented Generation service for ALGET.

Persists embeddings in Supabase pgvector when configured (so the index
survives Render free-tier cold starts) and falls back to an in-memory
cosine search when Supabase env vars are missing (local dev / offline).
"""
import glob
import hashlib
import math
import os
from typing import Any, Dict, List, Optional

try:
    from google import genai
    from google.genai import types as genai_types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


EMBEDDING_DIMENSION = 768


def _checksum(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class RAGService:
    """Pgvector-first RAG with in-memory fallback."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.embedding_model = "gemini-embedding-001"

        if GENAI_AVAILABLE and self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

        self.supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.supabase_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
            or ""
        )
        self.supabase_enabled = bool(
            HTTPX_AVAILABLE and self.supabase_url and self.supabase_key
        )

        self.knowledge_base: List[Dict[str, Any]] = []
        self._is_loaded = False

        backend = "pgvector" if self.supabase_enabled else "in-memory"
        print(f"[RAG Service] Initialized (backend={backend}).")

    # ---------- Embedding helpers ----------

    def _embed(self, content: str) -> Optional[List[float]]:
        if not self.client:
            return None
        try:
            config = None
            if hasattr(genai_types, "EmbedContentConfig"):
                config = genai_types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIMENSION
                )
            response = self.client.models.embed_content(
                model=self.embedding_model,
                contents=content,
                config=config,
            ) if config else self.client.models.embed_content(
                model=self.embedding_model,
                contents=content,
            )
            return list(response.embeddings[0].values)[:EMBEDDING_DIMENSION]
        except Exception as exc:
            print(f"[RAG Service] Embedding call failed: {exc}")
            return None

    # ---------- Supabase REST helpers ----------

    def _supabase_headers(self) -> Dict[str, str]:
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def _existing_checksums(self) -> Dict[str, str]:
        if not self.supabase_enabled:
            return {}
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(
                    f"{self.supabase_url}/rest/v1/rag_documents",
                    headers=self._supabase_headers(),
                    params={"select": "doc_id,content_checksum"},
                )
            if res.status_code >= 400:
                print(f"[RAG Service] Could not list existing docs: {res.status_code}")
                return {}
            rows = res.json() or []
            return {row["doc_id"]: row.get("content_checksum") for row in rows}
        except Exception as exc:
            print(f"[RAG Service] Existing-checksum fetch failed: {exc}")
            return {}

    def _upsert_supabase(self, doc_id: str, content: str, metadata: dict, embedding: List[float], checksum: str) -> bool:
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(
                    f"{self.supabase_url}/rest/v1/rag_documents?on_conflict=doc_id",
                    headers={**self._supabase_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                    json={
                        "doc_id": doc_id,
                        "content": content,
                        "metadata": metadata or {},
                        "embedding": embedding,
                        "content_checksum": checksum,
                    },
                )
            if res.status_code >= 400:
                print(f"[RAG Service] Supabase upsert {res.status_code}: {res.text[:200]}")
                return False
            return True
        except Exception as exc:
            print(f"[RAG Service] Supabase upsert failed for {doc_id}: {exc}")
            return False

    def _rpc_match(self, query_embedding: List[float], top_k: int) -> List[Dict[str, Any]]:
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    f"{self.supabase_url}/rest/v1/rpc/match_rag_documents",
                    headers=self._supabase_headers(),
                    json={"query_embedding": query_embedding, "match_count": top_k},
                )
            if res.status_code >= 400:
                print(f"[RAG Service] RPC match {res.status_code}: {res.text[:200]}")
                return []
            rows = res.json() or []
            return [
                {
                    "doc_id": row.get("doc_id"),
                    "content": row.get("content", ""),
                    "metadata": row.get("metadata") or {},
                    "similarity": row.get("similarity", 0.0),
                }
                for row in rows
            ]
        except Exception as exc:
            print(f"[RAG Service] RPC match failed: {exc}")
            return []

    # ---------- Public API ----------

    def load_curriculum(self, content_dir: str):
        """Discover .mdx files under content_dir and ensure each is embedded.

        With Supabase: skips embedding when the stored checksum matches, so
        cold starts are O(N file reads) instead of O(N Gemini calls).
        Without Supabase: falls back to one-shot in-memory indexing.
        """
        if self._is_loaded or not self.client:
            return

        print(f"[RAG Service] Indexing curriculum from {content_dir}...")
        search_pattern = os.path.join(content_dir, "**", "*.mdx")
        mdx_files = glob.glob(search_pattern, recursive=True)

        existing = self._existing_checksums() if self.supabase_enabled else {}
        embedded = 0
        skipped = 0

        for file_path in mdx_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception as exc:
                print(f"[RAG Service] Failed to read {file_path}: {exc}")
                continue

            doc_id = os.path.basename(file_path)
            checksum = _checksum(content)
            metadata = {"filename": doc_id, "path": file_path}

            if self.supabase_enabled and existing.get(doc_id) == checksum:
                skipped += 1
                continue

            if self.embed_document(doc_id, content, metadata, checksum=checksum):
                embedded += 1

        self._is_loaded = True
        print(
            f"[RAG Service] Curriculum loaded "
            f"(embedded={embedded}, cached={skipped}, total={len(mdx_files)})."
        )

    def embed_document(self, doc_id: str, content: str, metadata: dict = None, checksum: str = None) -> bool:
        if not self.client:
            print("[RAG Service] Error: Gemini client not initialized. Cannot embed.")
            return False

        embedding = self._embed(content)
        if embedding is None:
            return False

        meta = metadata or {}
        check = checksum or _checksum(content)

        if self.supabase_enabled:
            if self._upsert_supabase(doc_id, content, meta, embedding, check):
                return True
            print("[RAG Service] Supabase upsert failed; falling back to in-memory store for this doc.")

        self.knowledge_base.append(
            {
                "doc_id": doc_id,
                "content": content,
                "metadata": meta,
                "embedding": embedding,
            }
        )
        return True

    def retrieve_context(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        if not self.client:
            print("[RAG Service] Error: Gemini client not initialized. Cannot retrieve.")
            return []

        query_vector = self._embed(query)
        if query_vector is None:
            return []

        if self.supabase_enabled:
            rows = self._rpc_match(query_vector, top_k)
            if rows:
                return rows

        if not self.knowledge_base:
            return []

        def cosine_similarity(v1, v2):
            dot = sum(a * b for a, b in zip(v1, v2))
            n1 = math.sqrt(sum(a * a for a in v1))
            n2 = math.sqrt(sum(b * b for b in v2))
            if n1 == 0 or n2 == 0:
                return 0.0
            return dot / (n1 * n2)

        scored = [
            (cosine_similarity(query_vector, doc["embedding"]), doc)
            for doc in self.knowledge_base
            if "embedding" in doc
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [{"doc_id": d["doc_id"], "content": d["content"], "metadata": d.get("metadata", {}), "similarity": s} for s, d in scored[:top_k]]

    def generate_grounded_answer(self, query: str, task_prompt: str) -> str:
        contexts = self.retrieve_context(query)
        context_str = "\n\n".join(
            [f"Source {i+1}:\n{ctx['content']}" for i, ctx in enumerate(contexts)]
        )
        augmented_prompt = f"""
        Use the following retrieved academic and textbook context to answer the user's query.

        {task_prompt}

        <Retrieved Literature Context>
        {context_str if context_str else "No explicit literature context found."}
        </Retrieved Literature Context>

        User Query: {query}
        """
        print("[RAG Service] Generating grounded answer...")
        return augmented_prompt


rag_service = RAGService()
