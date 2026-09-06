# ALGET Engineering Study IRB Submission Crosswalk

Version: 1.0, 2026-08-15
Decision: **Current evidence approves only the earlier 60-person general ALGET study; submit an amendment or locate the authoritative expanded-scope approval before recruitment**

## UA submission basis

The University of Alabama currently directs social/behavioral researchers to prepare the HRP-503a protocol, use HRP-502 for informed consent, and attach all recruitment/advertising materials for IRB review before implementation. Human-subjects personnel must have current qualifying CITI human-subjects training; UA states that this training is renewed every three years. eProtocol is the submission system.

Because this study prospectively assigns learners to two support interventions and evaluates behavioral/educational outcomes, the PI should ask UA HRPP and the sponsor whether Common Rule/NIH clinical-trial registration, GCP training, or consent-form posting requirements apply. Do not infer an exemption from the educational setting alone.

## Attachment crosswalk

| Required component | Current source | Status | Required action |
|---|---|---|---|
| HRP-503a social/behavioral protocol | `docs/ENGINEERING_INTERVENTION_STUDY_PROTOCOL.md`; `01_Engineering_Intervention_Protocol_v2.docx/pdf` | Substantive draft complete | Transfer into current HRP-503a headings; fill personnel, setting, dates, compensation, retention, and approval fields |
| HRP-502 consent document | `docs/ENGINEERING_RECRUITMENT_AND_CONSENT_DRAFT.md` | Content draft | Transfer to current HRP-502; insert approved contacts/boilerplate and reconcile every value |
| Recruitment email | Recruitment draft section | Draft | IRB approval before sending |
| Classroom oral script | Recruitment draft section | Draft | Identify approved speaker and instructor-separation procedure |
| Web/flyer/QR text | Recruitment draft can be shortened after values freeze | Not finalized | Use UA-compliant format; attach every channel/version |
| Pre survey and Form A | Candidate v2.3 `SV_5z5mWwX62DyFRCC` | Inactive student-review copy; 35 questions | Configure 0-12 scoring; verify consent/eligibility, mismatch, duplicate, mobile, completion, and export paths |
| Post experience survey | Candidate v2.3 `SV_a33tQxcRlIVJILI` | Inactive student-review copy; 22 questions | Verify permissions, Study ID linkage, mobile, completion, and export paths |
| Immediate Form B | Candidate v2.3 `SV_8xjjebrtWhJnpKC` | Inactive student-review copy; integrity-denial branch corrected | Configure hidden 0-12 scoring; run expert/cognitive/pilot validation and synthetic path QA |
| Gift-card contact record | Candidate v2.3 `SV_0oz7vztCdDCiVr8` | Inactive separate contact project | Mark PII fields sensitive/restricted; limit collaborators/export; insert approved amount/milestones |
| Retention Form C | Candidate v2.3 `SV_6Xt3liTcZ5qhMxM` | Inactive student-review copy; integrity-denial branch corrected | Configure hidden 0-12 scoring; verify delayed invitation, mismatch, duplicate, mobile, completion, and export paths |
| Instrument/scoring appendix | `02_Engineering_Study_Instruments_v2.docx/pdf` | Draft; accessible/rendered | Permissions and burden confirmation |
| Assessment blueprint/rubric | `03_BioInspired_Assessment_Blueprint_v2.docx/pdf` | Development-only; accessible/rendered | 6-8 SME, 3-5 measurement experts, 8-12 cognitive interviews, 30-50 pilot |
| Data management/confidentiality | `docs/ENGINEERING_DATA_AND_COMPENSATION_SOP.md` | Draft | Name roles/storage; set record-class retention/destruction |
| Compensation plan | Compensation SOP | Values pending | Amount, milestones, timing, funding, tax, duplicate/reissue/withdrawal rules |
| Randomization plan | protocol; `research/prepare_engineering_randomization.py` | Implemented and tested | Freeze baseline bands after pilot; archive seed hash only |

The five earlier project IDs remain inactive historical HOLD artifacts. Do not activate or overwrite them; retain them only for controlled audit history.
| Technology/event data flow | protocol; Unity integration; Supabase migrations | Implemented locally/preview | Add one-page diagram if requested; staging/RLS/event reconciliation required |
| Analysis/preregistration | `research/ENGINEERING_PREREGISTRATION_TEMPLATE.md` | Draft | Fill after pilot and before confirmatory outcome access |
| Site/course permission | `[PENDING]` | Missing | Obtain department/instructor/site letters as required; use current UA template when applicable |
| Training/personnel | `[PENDING]` | Missing | Verify current CITI HSP for every listed person and role separation |
| Clinical-trial/registration determination | `[PENDING HRPP/SPONSOR DETERMINATION]` | Unresolved | Document determination and any registration/GCP/posting duties |

## Obsolete 2025 materials: controlled retirement

Do not submit or distribute the following unchanged:

- `01_Classroom_Announcement_Script.docx`
- `02_Email_Recruitment_Text.docx`
- `03_Website_Landing_Page_Content.docx`
- `04_Screening_Eligibility_Survey.docx`
- `05_Demographic_Questionnaire.docx`
- `08_Monthly_CheckIn_Survey.docx`
- `09_Final_User_Experience_Survey.docx`
- `10_Interview_Protocol.docx`
- `Assessment Items.docx`
- the unmodified `HRP-503a - TEMPLATE SBS PROTOCOL_ALGET.docx`

They describe a different single-group study, obsolete courses, 60 participants, monthly surveys, fixed $25/$40 compensation, unverified efficacy/personalization claims, and in some places an IRB-approved status that cannot be asserted for the revision. Retain them only as archived prior versions.

## Submission sequence

1. Freeze the feasibility-study design and decide whether the next submission covers only technical/measurement pilot activities or also the later confirmatory trial.
2. Fill the five investigator-controlled values in `engineering_study_manifest.json` plus study personnel, site, dates, and storage.
3. Transfer the protocol into the current HRP-503a and consent content into the current HRP-502 without retaining template instructions.
4. Reconcile burden, randomization, compensation, withdrawal, PII, retention, and contact language across every attachment.
5. Complete Qualtrics authenticated QA but keep all surveys inactive; attach printouts/final inactive QSF evidence as requested.
6. Attach recruitment email, announcement, landing/flyer text, instruments, assessment blueprint, data/compensation SOP, and site permissions.
7. Verify CITI training and obtain the clinical-trial/registration determination.
8. Submit in eProtocol. Do not recruit or collect identifiable/private research information before written approval.
9. After approval, use only stamped/current documents and submit amendments before planned changes.

## Final pre-submission audit

- No `[PENDING]`, old course, old sample, old monthly-survey, or old $25/$40 text remains in submitted files.
- Recruitment describes both intervention and comparison sources, who recruits, where/when/how, and every material/channel.
- Consent distinguishes instructional access from research participation and explains randomization and AI limitations.
- Instructor cannot observe consent, PII, compensation, or identifiable outcome data.
- Gift-card rules are equal by arm and not contingent on performance, opinions, or AI behavior.
- Data zones, role names, retention dates, incident procedure, and destruction method are explicit.
- All Qualtrics projects remain inactive until approval and QA evidence is archived.
- No document says “IRB approved” until the applicable approval letter exists.

## Authoritative institutional references

- University of Alabama Submission Guidance: https://research.ua.edu/offices/compliance/hrpp/review/submission-guidance/
- University of Alabama HRPP Toolkit: https://research.ua.edu/offices/compliance/hrpp/hrpp-toolkit/
- University of Alabama Researcher Responsibilities: https://research.ua.edu/offices/compliance/hrpp/review/researcher-responsibilities-after-irb-approval/
- University of Alabama Clinical Trial Registration guidance: https://research.ua.edu/offices/compliance/hrpp/clinical-trial-registration/
