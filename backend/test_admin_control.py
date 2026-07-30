from io import BytesIO
import unittest

from pypdf import PdfWriter

from admin_control import (
    build_governed_course_plan,
    build_google_doc_course_draft,
    convert_pdf_bytes,
    extract_google_doc_id,
)


def _blank_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


class AdminControlTests(unittest.TestCase):
    def test_pdf_conversion_validates_and_flags_scanned_like_pages(self):
        result = convert_pdf_bytes(_blank_pdf(), "source.pdf")

        self.assertEqual(result["page_count"], 1)
        self.assertTrue(result["quality"]["requires_ocr"])
        self.assertTrue(result["quality"]["human_approval_required"])
        self.assertEqual(result["status"], "needs_review")

    def test_pdf_conversion_rejects_non_pdf_payloads(self):
        with self.assertRaisesRegex(ValueError, "signature"):
            convert_pdf_bytes(b"not a pdf", "fake.pdf")

    def test_course_plan_has_one_release_agent_and_requires_human_gate(self):
        plan = build_governed_course_plan("statics-101", "source-1")

        self.assertEqual(plan["status"], "planned")
        self.assertEqual(plan["release_gate"], "human_approval_required")
        self.assertEqual(sum(stage["can_publish"] for stage in plan["stages"]), 1)
        self.assertEqual(plan["stages"][-1]["agent_id"], "release")

    def test_google_doc_link_is_allowlisted(self):
        document_id = "12345678901234567890"
        self.assertEqual(extract_google_doc_id(f"https://docs.google.com/document/d/{document_id}/edit?tab=t.0"), document_id)
        with self.assertRaises(ValueError):
            extract_google_doc_id("https://example.com/course.txt")

    def test_google_doc_draft_is_source_grounded_and_review_only(self):
        text = "Course Foundations\n" + ("Evidence evaluation requires comparing a claim with its source. " * 5) + "\nLearning Activity\n" + ("Learners revise the claim and explain the evidence. " * 5)
        result = build_google_doc_course_draft(text, "12345678901234567890", "Course Foundations")

        self.assertGreaterEqual(len(result["sections"]), 1)
        self.assertEqual(result["sections"][0]["simulation"]["status"], "proposed")
        self.assertFalse(result["quality"]["student_visible"])
        self.assertFalse(result["quality"]["automatic_publish"])


if __name__ == "__main__":
    unittest.main()
