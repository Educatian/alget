from io import BytesIO
import unittest

from pypdf import PdfWriter

from admin_control import build_governed_course_plan, convert_pdf_bytes


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


if __name__ == "__main__":
    unittest.main()
