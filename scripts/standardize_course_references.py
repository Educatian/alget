"""Add a consistent, verified reference block to engineering course sections.

The supplement courses already carry section-level references.  This script
only fills the five legacy courses whose prose had source mentions but no
machine-readable ``## References`` section.  It is intentionally idempotent.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "frontend" / "content"

REFERENCES = {
    "ai-ethics": [
        "Tabassi, E. (2023). *Artificial Intelligence Risk Management Framework (AI RMF 1.0).* NIST AI 100-1. https://doi.org/10.6028/NIST.AI.100-1",
        "UNESCO. (2021). *Recommendation on the Ethics of Artificial Intelligence.* https://www.unesco.org/en/legal-affairs/recommendation-ethics-artificial-intelligence?hub=1063",
        "European Parliament and Council of the European Union. (2024). *Regulation (EU) 2024/1689 (Artificial Intelligence Act).* https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32024R1689",
    ],
    "bio-inspired": [
        "Autumn, K., Liang, Y. A., Hsieh, S. T., Zesch, W., Chan, W.-P., Kenny, T. W., Fearing, R., & Full, R. J. (2000). *Adhesive force of a single gecko foot-hair.* Nature, 405, 681–685. https://doi.org/10.1038/35015073",
        "Autumn, K., Sitti, M., Liang, Y. A., Peattie, A. M., Hansen, W. R., Sponberg, S., Kenny, T. W., Fearing, R., Israelachvili, J. N., & Full, R. J. (2002). *Evidence for van der Waals adhesion in gecko setae.* Proceedings of the National Academy of Sciences, 99(19), 12252–12256. https://doi.org/10.1073/pnas.192252799",
        "Arzt, E., Gorb, S., & Spolenak, R. (2003). *From micro to nano contacts in biological attachment devices.* Proceedings of the National Academy of Sciences, 100(19), 10603–10606. https://doi.org/10.1073/pnas.1534701100",
    ],
    "dynamics": [
        "OpenStax. (2016). *University Physics, Volume 1.* Sections on Newton’s laws, work and energy, momentum, and rotational dynamics. https://openstax.org/details/books/university-physics-volume-1",
        "OpenStax. (2016). *University Physics, Volume 1.* Chapter 12: Static Equilibrium and Elasticity. https://openstax.org/books/university-physics-volume-1/pages/12-introduction",
    ],
    "statics": [
        "OpenStax. (2016). *University Physics, Volume 1.* Chapter 12: Static Equilibrium and Elasticity. https://openstax.org/books/university-physics-volume-1/pages/12-introduction",
        "OpenStax. (2016). *University Physics, Volume 1.* Section 10.6: Torque. https://openstax.org/books/university-physics-volume-1/pages/10-6-torque",
        "OpenStax. (2016). *University Physics, Volume 1.* Section 12.1: Conditions for Static Equilibrium. https://openstax.org/books/university-physics-volume-1/pages/12-1-conditions-for-static-equilibrium",
    ],
    "inst-design": [
        "Keller, J. M. (1987). *The systematic process of motivational design.* Performance + Instruction, 26(9), 1–8. https://doi.org/10.1002/pfi.4160260902",
        "Bloom, B. S. (1984). *The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring.* Educational Researcher, 13(6), 4–16. https://doi.org/10.3102/0013189X013006004",
    ],
}


def main() -> None:
    added = 0
    skipped = 0
    for course, refs in REFERENCES.items():
        for path in sorted((CONTENT / course).rglob("*.mdx")):
            text = path.read_text(encoding="utf-8")
            if "\n## References\n" in text or text.rstrip().endswith("## References"):
                skipped += 1
                continue
            block = "\n\n## References\n\n" + "\n".join(f"- {ref}" for ref in refs) + "\n"
            path.write_text(text.rstrip() + block, encoding="utf-8")
            added += 1
    print(f"added={added} skipped_existing={skipped}")


if __name__ == "__main__":
    main()
