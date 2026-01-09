# ALGET 콘텐츠 목록 v2

> **Statics + Dynamics** - UA Mechanical Engineering (1-2학년)

---

## 📊 콘텐츠 요약

| 과목 | Chapters | Sections | 총 파일 |
|------|----------|----------|---------|
| **Statics** | 3 | 10 | 30+ |
| **Dynamics** | 3 | 9 | 27+ |
| **Total** | 6 | 19 | 57+ |

---

# STATICS (정역학)

## Chapter 1: Equilibrium of a Particle

| Section | Title | Time | Key Concepts |
|---------|-------|------|--------------|
| 1.1 | Equilibrium Conditions | 25분 | ΣF=0, FBD, tension |
| 1.2 | Free Body Diagrams | 45분 | 6-step procedure, force identification |
| 1.3 | Two-Force/Three-Force Members | 40분 | two-force member, concurrency |
| 1.4 | **Friction** ⭐ | 50분 | μs, impending motion, direction |

## Chapter 2: Force Systems (Rigid Bodies)

| Section | Title | Time | Key Concepts |
|---------|-------|------|--------------|
| 2.1 | Moment of a Force | 50분 | M=r×F, Varignon, cross product |
| 2.2 | Couples and Equivalent Systems | 45분 | couple, free vector |
| 2.3 | Equilibrium of Rigid Bodies | 55분 | ΣM=0, support reactions |

## Chapter 3: Structural Analysis

| Section | Title | Time | Key Concepts |
|---------|-------|------|--------------|
| 3.1 | Simple Trusses | 40분 | m=2j-3, determinacy |
| 3.2 | Method of Joints | 55분 | joint equilibrium, T/C |
| 3.3 | Method of Sections | 50분 | cutting plane, moment point |

---

# DYNAMICS (동역학)

## Chapter 1: Kinematics of Particles

| Section | Title | Time | Key Concepts |
|---------|-------|------|--------------|
| 1.1 | Rectilinear Motion | 55분 | s-v-a, constant acceleration |
| 1.2 | Curvilinear Motion | 60분 | n-t coords, aₜ, aₙ |
| 1.3 | Relative Motion | 45분 | vB/A = vB - vA |

## Chapter 2: Kinetics of Particles

| Section | Title | Time | Key Concepts |
|---------|-------|------|--------------|
| 2.1 | Newton's Second Law | 60분 | ΣF=ma, friction, inclines |
| 2.2 | Work and Energy | 55분 | W=ΔT, conservation |
| 2.3 | Impulse-Momentum | 55분 | J=Δp, collisions |

## Chapter 3: Planar Rigid Body Dynamics

| Section | Title | Time | Key Concepts |
|---------|-------|------|--------------|
| 3.1 | Kinematics of Rigid Bodies | 50분 | ω, α, v=rω |
| 3.2 | Equations of Motion | 60분 | ΣM=Iα, moment of inertia |
| 3.3 | Work-Energy for Rigid Bodies | 50분 | T = ½mv² + ½Iω² |

---

## 📂 파일 구조

```
frontend/content/
├── statics/
│   ├── 01/  (Ch1: 4 sections - 1.1~1.4)
│   ├── 02/  (Ch2: 3 sections)
│   └── 03/  (Ch3: 3 sections)
└── dynamics/
    ├── 01/  (Ch1: 3 sections)
    ├── 02/  (Ch2: 3 sections)
    └── 03/  (Ch3: 3 sections)
```

섹션당 파일:
- `XX.mdx` - 본문 (Learning Objectives, Examples, Summary)
- `XX.meta.json` - 메타데이터 (prereqs, concepts, units_focus)
- `XX.practice.json` - 연습문제 (MCQ, Numeric, Step-based)
- `XX.misconceptions.json` - 오개념 패턴 *(Dynamics 1.1에 포함)*

---

## ⏱️ 총 학습 시간

| Course | Time |
|--------|------|
| Statics | ~7시간 |
| Dynamics | ~7.5시간 |
| **Total** | **~14.5시간** |

---

*Last Updated: 2026-01-09*
