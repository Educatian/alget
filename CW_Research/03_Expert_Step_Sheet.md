# ALGET CW Expert Step Sheet Template (전문가 워크시트)

## Cognitive Walkthrough for Intelligent Textbook

---

## Document Control

| 항목 | 내용 |
|------|------|
| **Study / Course** | Educational Technology – ALGET Intelligent Textbook Prototyping |
| **Prototype** | _(URL / Figma / Build 링크)_ |
| **Version / Date** | v1.0 / __________ |
| **Evaluator Name** | |
| **Evaluator ID** | E__ (E1–E5) |
| **Evaluator Type** | ☐ UX/HCI ☐ Learning Sciences ☐ Domain SME ☐ EdTech/AI ☐ Target Learner |
| **Evaluation Date** | |
| **Duration** | Start: _____ End: _____ Total: _____ min |

---

## A. 평가 전제 (Evaluation Assumptions)

### A1. Target Learner Persona (초심자 가정)

> 모든 평가자는 아래 학습자를 **시뮬레이션**하며 워크스루를 진행합니다.

| 항목 | 설정 |
|------|------|
| **학습자 유형** | Undergraduate Mechanical Engineering (1–2학년) |
| **사전지식** | 고등학교 물리/수학 수준 (대학 정역학 미이수) |
| **디지털 숙련도** | 중간 (LMS/웹 브라우저 사용 경험 있음, AI 도구 제한적) |
| **학습 맥락** | 수업 과제 수행 (Statics 개념 학습 + 바이오 디자인 탐색) |
| **동기** | 내재(호기심) + 외재(과제 제출) 혼합 |
| **접근성 요구** | 없음 (기본 설정) |

### A2. ALGET의 "지능" 기능 범위

아래 기능 중 이 프로토타입에서 **실제로 작동하는 것**만 체크:

- [ ] 학습 경로 추천/적응 (Adaptive pathway)
- [ ] 진단/퀴즈 기반 맞춤 (Placement/diagnostic)
- [x] 힌트/스캐폴딩 (Scaffolding) — Tutor Agent
- [ ] 학습분석 대시보드/진행률 (Analytics/Progress)
- [x] 생성형 AI 튜터/피드백 (GenAI feedback) — Multi-Agent
- [x] 메타인지 지원 (목표설정/반성/회고) — Janine's feedback
- [x] 시뮬레이션 (Interactive Simulation) — Engineer Agent

---

## B. Task List (과업 목록 요약)

> 상세 과업 정의는 `04_Task_Definitions.md` 참조.

| Task ID | Task Name | 핵심 행동 |
|---------|-----------|----------|
| T1 | 첫 학습 시작 + 콘텐츠 탐색 | 대시보드에서 Statics Chapter 1 진입 |
| T2 | Bio-Design Lab 질문 + AI 응답 해석 | 질문 입력 → 생물+공학 합성 결과 이해 |
| T3 | 스캐폴딩/검증 피드백 해석 + 반영 | Tutor 질문/Janine 평가 결과 활용 |
| T4 | 시뮬레이션 실행 + 학습 확인 | 인터랙티브 시뮬레이션 조작 → 개념 확인 |

---

## C. Severity Scale (0–4)

| 등급 | 라벨 | 기준 |
|------|------|------|
| **0** | None | 사용성/학습 문제 아님 |
| **1** | Cosmetic | 시간/예산 여유 있을 때만 수정 |
| **2** | Minor | 낮은 우선순위. 학습 진행에 약간 불편 |
| **3** | Major | 높은 우선순위. 학습 흐름에 유의미한 지장 |
| **4** | Critical | 반드시 수정. 학습 불가 또는 완전한 방향 상실 |

---

## D. Step Sheet — Task별 워크스루 테이블

> 아래 테이블을 **각 Task마다** 복사하여 작성합니다.

### [Task T__ : _________________________ ]

**Scenario**: _(시나리오 1–3문장)_

**Precondition**: _(시작 상태)_

**Success Criterion**: _(성공 기준)_

---

#### Step-by-Step Walkthrough Table

| Step # | Learner Sub-goal (학습자 하위목표) | Correct UI Action (정답 행동) | UI Cues Expected (라벨/위치/시각적 단서) |
|--------|----------------------------------|-----------------------------|-----------------------------------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| ... | | | |

---

#### CW Analysis Table (각 Step에 대해)

| Step # | CW-Q1 Goal (Y/N) | CW-Q2 Find (Y/N) | CW-Q3 Understand (Y/N) | CW-Q4 Feedback (Y/N) | L1 학습목표 명확 (Y/N) | L2 교육적 피드백 (Y/N) | L3 다음 행동 연결 (Y/N) |
|--------|-------------------|--------------------|-----------------------|----------------------|----------------------|----------------------|----------------------|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| ... | | | | | | | |

---

#### Issue Log (문제 발견 시 기록)

| Step # | Issue Description | Likely Wrong Action (오답 행동) | Problem Type | Severity (0–4) | Evidence (Screen/URL) | Fix Idea |
|--------|------------------|---------------------------------|-------------|---------------|----------------------|----------|
| | | | | | | |
| | | | | | | |

**Problem Type 코드**:

- `Goal` — 학습자가 올바른 목표를 형성하지 못함
- `Find` — 올바른 행동/컨트롤을 찾지 못함
- `Understand` — 행동과 결과의 연결을 이해하지 못함
- `Feedback` — 시스템 피드백이 불명확/부재
- `Nav/Search` — 내비게이션/탐색 문제 (CWW 확장)
- `Learning` — 학습 관련 문제 (L1/L2/L3)

---

## E. Task 종료 요약 (Task Summary, 각 Task마다 작성)

### Task T__ Summary

| 항목 | 내용 |
|------|------|
| **Fragile Steps (깨지기 쉬운 단계 Top 1–3)** | Step __: / Step__: / Step __: |
| **Dominant Breakdown** | ☐ Goal ☐ Find ☐ Understand ☐ Feedback ☐ Nav/Search ☐ Learning |
| **Learnability Risk** | ☐ Low ☐ Medium ☐ High |
| **Priority Fixes (Severity 3–4)** | 1. / 2. / 3. |

---

## F. 전체 요약 (Overall Summary)

> Task 1–4 완료 후 작성합니다.

### F1. 반복적으로 나타난 문제 패턴

| 패턴 | 관련 Tasks | 횟수 |
|------|-----------|------|
| (예: Find 문제 반복) | | |
| (예: 피드백 불명확) | | |

### F2. 학습 지원 관점에서 가장 큰 결함

_(자유 서술, 2–5문장)_

### F3. AI/지능 기능 관련 이슈

_(학습자가 AI 응답/추천의 로직을 "납득" 가능한가?)_

### F4. Quick Wins vs 구조적 수정

| Quick Wins (즉시 수정 가능) | 구조적 수정 (IA/피드백 설계/적응 로직) |
|----------------------------|--------------------------------------|
| 1. | 1. |
| 2. | 2. |
| 3. | 3. |

### F5. 추가 의견

_(자유 서술)_

---

_이 워크시트를 작성해 주셔서 감사합니다. Coordinator에게 제출해 주세요._

_문서 버전: v1.0 | 작성일: 2026-02-28_
