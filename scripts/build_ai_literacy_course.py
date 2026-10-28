"""Build the AI Literacy course (frontend/content/ai-literacy) for first- to third-year undergraduates.

Each section gets the four files the reader and audits expect: NN.mdx, NN.meta.json,
NN.practice.json and NN.misconceptions.json. Edit the content here and re-run:

    python scripts/build_ai_literacy_course.py

3D labs are embedded with <sketch-lab book="ai" lesson="..."/> (see SketchLab.jsx). Video ids
were checked against YouTube oEmbed on 2026-10-28.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "content" / "ai-literacy"


def quiz(question, options, correct, concept):
    opts = json.dumps(options).replace("'", "&#39;")
    return f"<interactive-quiz question=\"{question}\" options='{opts}' correct-index=\"{correct}\" conceptid=\"{concept}\" />"


def problem(pid, concept, stem, options, correct, explanation, misconception):
    return {"id": pid, "type": "multiple_choice", "concept_id": concept, "stem": stem, "options": options,
            "correct_index": correct, "explanation": explanation, "misconception_id": misconception}


def misconception(mid, pattern, description, trigger, feedback, action="reframe"):
    return {"id": mid, "pattern": pattern, "description": description, "trigger": trigger, "feedback": feedback, "rail_action": action}


SECTIONS = []


def section(ch, sec, chapter_title, title, description, objectives, concepts, minutes, body, problems, misconceptions):
    SECTIONS.append(dict(ch=ch, sec=sec, chapter_title=chapter_title, title=title, description=description,
                         objectives=objectives, concepts=concepts, minutes=minutes, body=body.strip(),
                         problems=problems, misconceptions=misconceptions))


# ---------------------------------------------------------------- Module 1: How AI works
M1 = "How AI Works"

section(1, 1, M1, "What Counts as AI?",
        "Recognize AI in everyday tools, tell narrow AI from the idea of general AI, and describe AI as systems that learn patterns from data.",
        ["Describe artificial intelligence as systems that perform tasks by learning patterns from data.",
         "Identify at least three AI systems you already use as a student.",
         "Distinguish narrow AI, which exists today, from the idea of general AI."],
        ["ai_definition", "narrow_vs_general_ai", "everyday_ai"], 10, f"""
# What Counts as AI?

You probably used AI several times before your first class today. Your email sorted spam from real messages. Your phone suggested the next word as you typed. A streaming service lined up what to watch next. None of these feel like science fiction, and that is the point: most AI is quiet, specific and built into tools you already use.

## A working definition

In this course, **artificial intelligence (AI)** means computer systems that do tasks we usually associate with human thinking, such as recognizing images, understanding language, or making recommendations, by **learning patterns from data** rather than following only rules a programmer wrote by hand.

That last part matters. A calculator follows fixed rules. A spam filter learns from millions of emails that people marked as spam, and it keeps adjusting. When you ask "is this AI?", a useful test is: *did the system learn its behavior from examples?*


## AI on a college campus

Look for AI in places like these:

- **Writing and reading tools:** autocomplete, grammar suggestions, chatbots, summarizers.
- **Search and recommendations:** search results, library discovery tools, video and music suggestions.
- **Campus systems:** plagiarism and AI-text detectors, early-alert systems that flag students, chat assistants on university websites.
- **Phones and cameras:** face unlock, photo grouping, voice assistants, live captions.

## Narrow AI and general AI

Every system above is **narrow AI**: it is built for one kind of task. A model that writes fluent paragraphs cannot drive a car, and a face-unlock system cannot summarize a reading. **General AI**, a system that could learn and reason across any task the way people can, is a goal some researchers pursue and others doubt, but it is not what you are using today. Keeping this distinction in mind helps you judge headlines that describe a narrow tool as if it "understands" everything.

{quiz("Which of these is the best evidence that a tool uses AI?", ["It runs on a computer.", "It learned its behavior from many examples of data.", "It has a friendly chat window.", "It gives an answer instantly."], 1, "ai_definition")}

## Try this

Open your phone and find three features that learned from data. For each one, write what it predicts (for example, "the next word I will type") and what data it might have learned from. Keep the list: you will use it again in Module 2.
""",
        [problem("ail_101_a", "ai_definition", "What most clearly separates an AI spam filter from a calculator?",
                 ["The spam filter is faster.", "The spam filter learned its behavior from labelled examples; the calculator follows fixed rules.", "The calculator uses more electricity.", "The spam filter never makes mistakes."], 1,
                 "AI systems learn patterns from data. Fixed-rule tools do exactly what they were programmed to do.", "ai_is_any_computer"),
         problem("ail_101_b", "narrow_vs_general_ai", "A chatbot writes a strong essay outline. What does that show?",
                 ["It has general intelligence and can do any task.", "It is good at one kind of task, producing text, which is narrow AI.", "It understands the topic the way an expert does.", "It can be trusted on every fact in the outline."], 1,
                 "Fluent text shows skill at a narrow task. It is not evidence of general intelligence or of factual accuracy.", "fluency_means_general"),
         problem("ail_101_c", "everyday_ai", "Which campus tool is most likely to use AI?",
                 ["A printed course catalog.", "A library search that ranks results by relevance.", "A room-number sign.", "A paper attendance sheet."], 1,
                 "Ranking search results by learned relevance is a common use of AI.", "ai_is_only_chatbots")],
        [misconception("ai_is_any_computer", "overextension", "Treating any computer program as AI.", "learner calls a calculator or spreadsheet formula AI",
                       "Ask whether the system learned from data. Programs that only follow hand-written rules are not what we mean by AI here."),
         misconception("ai_is_only_chatbots", "underextension", "Thinking AI means only chatbots.", "learner cannot name AI in search, cameras or recommendations",
                       "Most AI is built into everyday tools: spam filters, recommendations, autocomplete, face unlock. Chatbots are one visible example.")])

section(1, 2, M1, "How Language Models Write",
        "See how a language model produces text one word at a time by assigning probabilities and sampling, and why fluent text is not the same as true text.",
        ["Explain that a language model predicts a probability for each possible next word and samples one.",
         "Describe what the temperature setting changes in a model's output.",
         "Explain why a likely-sounding answer can still be false."],
        ["next_token_prediction", "sampling_temperature", "fluency_vs_truth"], 15, f"""
# How Language Models Write

When you ask a chatbot a question, it does not look the answer up in a list of facts. A **large language model** writes its reply one small piece at a time. At every step it answers a narrow question: *given everything so far, which word is likely to come next?*

## One word at a time

The pieces a model reads and writes are called **tokens**: whole words or parts of words. For each next token, the model gives every token it knows a **probability**. Then it **samples**: it picks one, with likely tokens picked more often. The chosen token is added to the text, and the process repeats until the reply is done.

<lesson-video src="/media/ai-literacy/NextWordVideo.mp4" title="How a language model writes (1 min 16 s)" caption="Narrated, with captions. Watch how the bars change with temperature." />

## Try it: the probability wheel

In the lab below, each slice of the wheel is one candidate next word, and its size is the probability. Spinning the wheel is sampling. Change the **temperature** and watch the slices change size, but notice that together they always make 100 %.

<sketch-lab book="ai" lesson="next-word" title="How AI writes: the probability wheel" caption="Make a prediction first, then watch the demonstration and try the Australia sentence." />

## Why the same question gets different answers

Because each word is sampled, the same prompt can produce different replies. Low temperature makes the top word nearly certain, so answers become more repetitive. High temperature evens out the slices, so answers become more varied and more surprising.

## Fluent is not the same as true

The model learned which words tend to follow which, from enormous amounts of text. That makes its writing fluent. But "likely to come next" is not the same as "true". In the lab, *Sydney* gets a big slice after "The capital of Australia is", because the two words often appear together, yet the capital is Canberra. This is one root of **hallucinations**: confident, well-written statements that are wrong.

{quiz("You ask a chatbot the same question twice and get two different answers. What is the best explanation?", ["The chatbot changed its mind after learning something new.", "Each reply samples words from probabilities, so it can vary.", "One of the replies came from a different company.", "The first answer was deleted."], 1, "sampling_temperature")}
""",
        [problem("ail_102_a", "next_token_prediction", "What does a language model do at each step of writing a reply?",
                 ["Looks the answer up in a database of facts.", "Gives each possible next token a probability and samples one.", "Copies a full answer written by a person.", "Asks a human expert."], 1,
                 "Language models build replies token by token from learned probabilities.", "model_looks_up_answers"),
         problem("ail_102_b", "sampling_temperature", "What happens when you lower the temperature?",
                 ["The most likely word becomes even more likely, so output is more predictable.", "The model learns new facts.", "Every word becomes equally likely.", "The model stops making mistakes."], 0,
                 "Low temperature sharpens the probabilities toward the top choice.", "temperature_is_accuracy"),
         problem("ail_102_c", "fluency_vs_truth", "Why can a well-written AI answer still be wrong?",
                 ["Because grammar checkers are turned off.", "Because the model chooses likely words, and likely is not the same as true.", "Because long answers are always wrong.", "Because AI never uses real data."], 1,
                 "The model optimizes for plausible text. Plausible text can contain false claims.", "fluency_means_truth")],
        [misconception("model_looks_up_answers", "retrieval_model", "Believing the model retrieves stored answers.", "learner says the chatbot 'searched its database'",
                       "A language model generates text from learned probabilities. Some tools also search the web, but the writing itself is generated."),
         misconception("fluency_means_truth", "fluency_heuristic", "Trusting text because it is fluent and confident.", "learner accepts an answer because it 'sounds right'",
                       "Fluency comes from predicting likely words. Check facts against sources, especially names, numbers and citations.")])

section(1, 3, M1, "Strengths and Limits",
        "Match AI tools to the tasks they do well, and recognize the limits that call for human checking.",
        ["List tasks where language models are typically helpful.",
         "Describe common limits: hallucinations, outdated knowledge, weak arithmetic and invented citations.",
         "Decide when an AI output needs checking before use."],
        ["ai_strengths", "hallucination", "knowledge_limits"], 10, f"""
# Strengths and Limits

Knowing how a language model writes tells you what to expect from it. It is very good at producing plausible language. It is not built to guarantee that what it writes is accurate.

## What it tends to do well

- **Drafting and rephrasing:** first drafts, simpler explanations, different tones.
- **Summarizing** a text you provide, so you can check the summary against the original.
- **Brainstorming:** questions to research, counterarguments, examples.
- **Explaining a concept in several ways**, so you can find one that clicks.
- **Giving feedback** on clarity and structure of your own writing.

Notice the pattern: these are tasks where *you* can judge the result.

## Where it often goes wrong

- **Hallucinations:** confident statements, names or numbers that are false.
- **Invented citations:** references that look real but do not exist, or say something different.
- **Out-of-date knowledge:** a model learned from data up to a certain date; unless the tool searches the web, it may not know recent events.
- **Precise calculation and counting**, unless the tool runs real code.
- **Not knowing what it does not know:** it rarely says "I am not sure" unless asked.

Some tools add web search or file reading. That helps, but the summary of what was found is still generated text, so the checking habit stays the same.

{quiz("For which task is an AI chatbot's output easiest for you to check yourself?", ["A list of five peer-reviewed sources on a topic you have not read about.", "A clearer rewrite of a paragraph you wrote.", "The exact population of a city this year.", "A legal answer about your housing contract."], 1, "ai_strengths")}

## A quick rule of thumb

Before using an AI output, ask: **how would I know if this were wrong?** If you can check it easily (your own paragraph, a summary of a text you have), use it with care. If you cannot (facts you do not know, sources you have not seen), treat it as a lead to verify, not as an answer. Module 3 turns this into a routine.
""",
        [problem("ail_103_a", "hallucination", "What is an AI hallucination?",
                 ["A picture the AI draws.", "A confident statement from the AI that is false.", "A slow response.", "A refusal to answer."], 1,
                 "Hallucinations are fluent, confident outputs that are not true.", "fluency_means_truth"),
         problem("ail_103_b", "knowledge_limits", "Why might a chatbot get a recent event wrong?",
                 ["It learned from data up to a cutoff date and may not search the web.", "It dislikes current events.", "It is not allowed to use dates.", "Recent events are always secret."], 0,
                 "Models learn from data up to a point in time; without search they cannot know later events.", "ai_knows_everything_current"),
         problem("ail_103_c", "ai_strengths", "Which use plays to a language model's strengths?",
                 ["Getting exact statistics you will cite without checking.", "Getting three alternative explanations of a concept you are studying.", "Getting a final grade decision.", "Getting medical diagnoses."], 1,
                 "Re-explaining concepts is a strength, and you can judge which explanation helps.", "ai_is_an_oracle")],
        [misconception("ai_knows_everything_current", "omniscience", "Assuming the model knows current facts.", "learner asks about this week's events and trusts the answer",
                       "Models learn from data up to a cutoff. Check dates and recent facts against a current source."),
         misconception("ai_is_an_oracle", "authority_transfer", "Treating AI output as authoritative.", "learner cites the chatbot as the source of a fact",
                       "A chatbot is not a source. Find and cite the original evidence.")])

# ---------------------------------------------------------------- Module 2: Data, training and bias
M2 = "Data, Training and Bias"

section(2, 1, M2, "Learning from Data",
        "Understand training data, labels and generalization, and see that choices about data are human choices.",
        ["Describe how a model learns from labelled training examples.",
         "Explain generalization: performing on new examples the model has not seen.",
         "Identify human decisions involved in collecting and labelling data."],
        ["training_data", "labels", "generalization"], 10, f"""
# Learning from Data

Every AI system you met in Module 1 learned from **training data**: a large set of examples. What is in that data shapes what the system can do, and what it gets wrong.

## Examples, labels and patterns

Imagine teaching a model to recognize pets in photos. You collect thousands of photos and **label** each one: *cat*, *dog*, *no pet*. During **training**, the model adjusts millions of internal numbers until its guesses match the labels as often as possible. It is not memorizing each photo; it is finding **patterns** that separate cats from dogs.

Language models learn in a similar way, but the "label" is simply the next word in real text. That is why they absorb the style, the facts and also the errors and stereotypes in the text they were trained on.

## Generalization

A model is useful only if it works on **new** examples it never saw. This is called **generalization**. Teams test it by holding back some labelled examples and checking accuracy on them. A model generalizes well to new examples that *resemble its training data*. When new examples differ, for instance photos taken at night when training photos were mostly in daylight, accuracy can drop sharply. Lesson 2.2 lets you see this happen.

## People make the data decisions

Data does not appear on its own. People decide:

- **What to collect**, and from whom.
- **What labels mean**, and who does the labelling.
- **What counts as success**, such as which errors matter most.
- **What gets left out**, often by accident.

Each choice affects who the system works well for.

{quiz("A model is tested on new examples that look like its training data and does well. What does that show?", ["It will work equally well on every kind of example.", "It generalizes to examples similar to its training data.", "It memorized the test answers.", "Its training data had no errors."], 1, "generalization")}

## Try this

Pick one AI feature from your Module 1 list. Write down what its training examples probably were, who might have labelled them, and one kind of user or situation that might be missing from that data.
""",
        [problem("ail_201_a", "training_data", "What is training data?",
                 ["The settings menu of an app.", "The examples a model learns patterns from.", "The user manual.", "A list of the model's mistakes."], 1,
                 "Models learn by adjusting to many examples called training data.", "data_is_neutral"),
         problem("ail_201_b", "labels", "In a photo classifier, what is a label?",
                 ["The file name.", "The correct answer attached to each training example, such as 'cat'.", "The photo's brightness.", "The camera brand."], 1,
                 "Labels tell the model the right answer for each training example.", "labels_are_objective"),
         problem("ail_201_c", "generalization", "Why test a model on examples held back from training?",
                 ["To make training faster.", "To see whether it works on new examples it has not seen.", "To delete bad data.", "To give the model more labels."], 1,
                 "Held-out testing checks generalization.", "data_is_neutral")],
        [misconception("data_is_neutral", "neutral_data", "Believing data is neutral and objective.", "learner says 'the model just reflects reality'",
                       "Data reflects choices about what to collect, how to label it and who is included. Those choices shape results."),
         misconception("labels_are_objective", "objective_labels", "Assuming labels are always correct and agreed.", "learner ignores who labelled the data",
                       "Labels are human judgments. They can be inconsistent or reflect the labellers' assumptions.")])

section(2, 2, M2, "Bias In, Bias Out",
        "Use a 3D lab to see how an imbalanced training set produces a model that fails one group, and fix it by covering the missing group.",
        ["Explain how under-representation in training data can cause worse results for a group.",
         "Show why a single overall accuracy number can hide a gap between groups.",
         "Describe how rebalancing training data can reduce the gap."],
        ["representation_bias", "disaggregated_accuracy", "real_world_harm"], 15, f"""
# Bias In, Bias Out

If some kinds of examples are rare in the training data, the model often learns them poorly. The result can be a system that looks accurate on average while failing a particular group again and again.

## See it happen

In the lab, a pet-photo model is trained mostly on daytime photos. Train it, then look at the test results: the overall gauge looks good, but the night-photo tiles tell a different story. Then change the training mix and train again.

<sketch-lab book="ai" lesson="bias" title="Bias in, bias out: the photo model" caption="Predict first: is a model that is 92 % accurate overall equally good for everyone's photos?" />

## Averages hide gaps

An **overall accuracy** is an average across everyone tested. If one group is small, its failures barely move the average. That is why responsible evaluations report **disaggregated** results: accuracy for each group separately.

## Real cases

This is not only a lab effect. In 2018, Joy Buolamwini and Timnit Gebru tested commercial face-analysis systems and found far higher error rates for darker-skinned women than for lighter-skinned men. In 2020, a study of speech-recognition systems found much higher error rates for Black speakers than for white speakers. In both cases, the groups with the highest errors were under-represented in the data the systems learned from.

<lesson-video src="/media/ai-literacy/BiasVideo.mp4" title="Accurate for whom? (1 min 9 s)" caption="Narrated, with captions. Compare the overall bar with the night-photo bar." />

{quiz("A model is 95 % accurate overall but 70 % accurate for one group. What should you conclude?", ["It works well for everyone.", "The overall number hides a large gap; the group needs attention.", "The group is using it wrong.", "Accuracy numbers are meaningless."], 1, "disaggregated_accuracy")}

## Fixing it

More data helps only if it covers the missing group. In the lab, adding more daytime photos changes nothing for night photos; adding night photos closes the gap. Real fixes also include testing each group, involving affected people, and deciding when a system should not be used at all.
""",
        [problem("ail_202_a", "representation_bias", "Why might a model do worse on night photos?",
                 ["Night photos are always blurry.", "Night photos were rare in its training data.", "Models cannot see dark colors.", "The test was unfair."], 1,
                 "Under-represented examples are learned poorly.", "more_data_fixes_bias"),
         problem("ail_202_b", "disaggregated_accuracy", "What does disaggregated accuracy mean?",
                 ["Accuracy reported separately for each group.", "Accuracy rounded to whole numbers.", "Accuracy measured twice.", "Accuracy without any test data."], 0,
                 "Reporting by group reveals gaps that averages hide.", "average_is_enough"),
         problem("ail_202_c", "real_world_harm", "What did the 2018 Gender Shades study find?",
                 ["All face systems were equally accurate.", "Error rates were much higher for darker-skinned women.", "Face systems never make errors.", "Only lighting mattered."], 1,
                 "The study documented large accuracy gaps by skin type and gender.", "bias_is_rare")],
        [misconception("average_is_enough", "aggregate_only", "Trusting a single overall accuracy number.", "learner says '92 % accurate, so it works'",
                       "Ask: accurate for whom? Look for results broken down by group."),
         misconception("more_data_fixes_bias", "volume_fix", "Believing more data always fixes bias.", "learner adds more of the same data to fix a gap",
                       "More of the same data does not help the missing group. Coverage of that group does.")])

section(2, 3, M2, "Accurate for Whom?",
        "Turn the bias lesson into questions you can ask about any AI tool used in your courses, jobs or campus life.",
        ["Ask evaluation questions about who an AI tool was tested on.",
         "Explain why different errors can have different costs for different people.",
         "Describe the role of human oversight when an AI tool affects decisions about people."],
        ["evaluation_questions", "error_costs", "human_oversight"], 10, f"""
# Accurate for Whom?

You will meet AI tools that make or support decisions about people: application screeners, early-alert systems, AI-text detectors, proctoring software. You may not build them, but you can ask good questions about them.

## Five questions to ask

1. **Who was it tested on?** Do the test groups resemble the people it will be used on?
2. **How accurate is it for each group?** Ask for results broken down, not just an overall number.
3. **What kinds of errors happen?** A false alarm and a missed case are different mistakes.
4. **Who pays for the errors?** A wrongly flagged student loses time, trust or more. Who can appeal?
5. **Who checks the decision?** Is a person reviewing the output before it affects someone?

## Different errors, different costs

Consider an AI-text detector. A **false positive** says a student's own writing was AI-generated. A **false negative** misses AI-written text. Detectors have been shown to flag writing by non-native English speakers more often, which means the cost of false positives falls unevenly. That is why many institutions advise against using such scores as the only evidence.

{quiz("An AI tool flags students as 'at risk'. Which question best reveals a fairness problem?", ["How fast is the tool?", "How accurate is it for each group of students, and who reviews the flags?", "What color is the dashboard?", "How many students use it?"], 1, "evaluation_questions")}

## Human oversight

**Human oversight** means a person with authority reviews AI outputs that affect people, can override them, and is accountable for the final decision. Oversight only works if the person has the time, information and permission to disagree with the tool.

## Try this

Choose one AI tool used at your university or workplace. Write one sentence answering each of the five questions, or note where you could not find the answer. Missing answers are findings too.
""",
        [problem("ail_203_a", "error_costs", "An AI detector says your own essay was AI-written. What kind of error is this?",
                 ["A false positive.", "A false negative.", "A correct detection.", "A sampling error."], 0,
                 "Flagging genuine work as AI-generated is a false positive.", "errors_are_equal"),
         problem("ail_203_b", "evaluation_questions", "Which question best checks whether a tool works for your group?",
                 ["Is the tool popular?", "Was it tested on people like the ones it will be used on, with results reported by group?", "Does it use the newest model?", "Is it free?"], 1,
                 "Test populations and disaggregated results show who the tool works for.", "average_is_enough"),
         problem("ail_203_c", "human_oversight", "What makes human oversight meaningful?",
                 ["A person glances at the output after the decision is made.", "A person with authority reviews outputs, can override them and is accountable.", "The AI explains itself.", "The tool has a warning label."], 1,
                 "Oversight requires authority, information and accountability.", "rubber_stamp_oversight")],
        [misconception("errors_are_equal", "symmetric_errors", "Treating all errors as equally costly.", "learner reports only overall error rate",
                       "False positives and false negatives harm different people in different ways. Ask who pays for each."),
         misconception("rubber_stamp_oversight", "nominal_oversight", "Assuming any human in the loop is enough.", "learner says 'a person signs off, so it is fine'",
                       "A reviewer needs time, information and permission to overrule the tool, or oversight is only a formality.")])

# ---------------------------------------------------------------- Module 3: Asking AI well and checking results
M3 = "Asking AI Well and Checking the Results"

section(3, 1, M3, "What to Hand to AI",
        "Decide which parts of a task to delegate to AI, which to keep, and where you keep the final decision.",
        ["Separate a task into parts you can delegate and parts that are the point of the learning.",
         "Explain why delegating the thinking a course is meant to build can undermine learning.",
         "Keep responsibility for the final decision and the final work."],
        ["task_delegation", "protecting_learning_goals", "final_decision"], 10, f"""
# What to Hand to AI

Using AI well starts before you type anything. The first question is not *how do I ask?* but *what should I ask for at all?*

## Split the task

Most assignments mix two kinds of work:

- **Support work:** formatting a reference list, checking grammar, explaining a term you looked up, suggesting how to organize your notes.
- **Core work:** the thinking the assignment is designed to build, such as forming an argument, analyzing data, designing a solution, or reflecting on your experience.

Delegating support work can save time. Delegating core work can mean you skip the learning the course is for, even when the result looks good.

## Three questions before you delegate

1. **Is this the skill the assignment is meant to build?** If yes, keep it, and use AI for feedback or practice instead.
2. **Is AI use allowed here, and how?** Check the syllabus or ask the instructor. Policies differ between courses.
3. **Can I check the result?** If you cannot tell whether the output is right, you are not ready to delegate it.

## Keep the final decision

Whatever you delegate, **you** decide what to keep, change or throw away, and you are responsible for what you submit. A useful habit is to write one sentence for each AI contribution: what you asked, what you changed, and why.

{quiz("You must write a reflection on your own internship experience. Which use of AI best protects the learning goal?", ["Ask AI to write the reflection from your job title.", "Write the reflection yourself, then ask AI for feedback on clarity.", "Ask AI to invent experiences that sound impressive.", "Submit AI text and edit one word."], 1, "protecting_learning_goals")}

## Try this

Take your next assignment. List its parts. Mark each part **keep**, **delegate** or **get feedback**. Note one thing you will check in anything AI produces.
""",
        [problem("ail_301_a", "task_delegation", "Which part of a research paper is the best candidate to delegate?",
                 ["Forming your thesis.", "Formatting references you have already found and checked.", "Choosing which evidence supports your argument.", "Writing your conclusion."], 1,
                 "Formatting checked references is support work; the argument is core work.", "delegate_everything"),
         problem("ail_301_b", "protecting_learning_goals", "Why can delegating core work hurt you even if the result looks good?",
                 ["Because AI is always wrong.", "Because you skip practicing the skill the assignment is meant to build.", "Because it takes longer.", "Because instructors dislike technology."], 1,
                 "Learning comes from doing the thinking; outsourcing it removes the practice.", "good_output_means_learning"),
         problem("ail_301_c", "final_decision", "Who is responsible for work you submit that used AI?",
                 ["The AI company.", "You.", "Nobody.", "The instructor."], 1,
                 "You remain accountable for what you submit.", "ai_takes_responsibility")],
        [misconception("good_output_means_learning", "output_equals_learning", "Equating a good product with learning.", "learner says 'the essay is good, so I learned it'",
                       "Learning comes from doing the thinking. A good product you did not think through may leave the skill unpracticed."),
         misconception("ai_takes_responsibility", "responsibility_shift", "Believing AI use shifts responsibility.", "learner blames the tool for errors in submitted work",
                       "You choose what to submit, so you are responsible for it. Check before you use.")])

section(3, 2, M3, "Writing a Clear Request",
        "Write prompts with a clear goal, context, constraints and format, and improve results by iterating.",
        ["Include goal, context, constraints and output format in a request.",
         "Improve a weak prompt by adding missing information.",
         "Use follow-up turns to refine, question and check an output."],
        ["prompt_components", "iteration", "asking_for_uncertainty"], 12, f"""
# Writing a Clear Request

A model can only work with what you give it. Vague requests get generic answers. Clear requests get answers you can actually use and check.

## Four parts of a clear request

1. **Goal:** what you are trying to do and why. *"I am preparing for a quiz on photosynthesis."*
2. **Context:** what the model needs to know. *"I understand light reactions but not the Calvin cycle."*
3. **Constraints:** limits and rules. *"Use plain language, no more than 150 words, and do not skip steps."*
4. **Format:** what the output should look like. *"End with three practice questions, answers hidden at the bottom."*

## Before and after

> **Weak:** "Explain the Calvin cycle."
>
> **Clear:** "I'm a first-year biology student preparing for a quiz. I understand the light reactions but not the Calvin cycle. Explain it in plain language in under 150 words, step by step. Then give me three practice questions with the answers at the end."

The second request gives the model a target it can hit, and gives you something you can check against your textbook.

## Iterate, do not accept the first answer

Treat the first reply as a draft. Useful follow-ups:

- *"Which part of this are you least sure about?"*
- *"Give me a source I can check for step 2."*
- *"Explain it a different way, with an everyday analogy."*
- *"Ask me three questions to check that I understood."*

Remember from Module 1 that replies are sampled: asking again can give a different answer, and that difference is itself a signal to check.

{quiz("Which request is most likely to give a useful, checkable answer?", ["Tell me about climate change.", "I'm writing a 2-page policy brief for a city council on heat waves. Summarize three evidence-based strategies in plain language, under 200 words, and name a report I can check for each.", "Climate???", "Write something good."], 1, "prompt_components")}

## Do not paste what you should not share

Clear context does not mean sharing everything. Leave out personal and confidential details; Module 4 shows why.
""",
        [problem("ail_302_a", "prompt_components", "Which part is missing from: 'Summarize this article in bullet points'?",
                 ["Format.", "Goal and context: why you need the summary and what you will use it for.", "Nothing is missing.", "The model's name."], 1,
                 "The request gives a format but no goal or context, so the model cannot prioritize.", "short_prompts_are_best"),
         problem("ail_302_b", "iteration", "The first reply is generic. What is the best next step?",
                 ["Accept it.", "Add context and constraints, or ask a focused follow-up.", "Give up on AI.", "Ask the same thing in capital letters."], 1,
                 "Refining the request usually improves the result.", "first_answer_is_final"),
         problem("ail_302_c", "asking_for_uncertainty", "Why ask the model which part it is least sure about?",
                 ["To make it apologize.", "To find the parts most worth checking.", "To speed it up.", "To change its temperature."], 1,
                 "It points you to likely weak spots, though you still need to verify everything important.", "first_answer_is_final")],
        [misconception("short_prompts_are_best", "minimal_prompting", "Believing shorter prompts always work best.", "learner gives one-line requests and blames the tool",
                       "Goal, context, constraints and format usually improve the result."),
         misconception("first_answer_is_final", "single_shot", "Treating the first reply as final.", "learner never asks a follow-up",
                       "Iterate: question, refine and check. The first reply is a draft.")])

section(3, 3, M3, "Checking Claims and Sources",
        "Check AI answers claim by claim against their sources, and spot contradicted claims and fabricated references.",
        ["Break an AI answer into separate claims that can be checked.",
         "Judge each claim as supported, contradicted or without a real source.",
         "Use lateral reading to check sources outside the answer itself."],
        ["claim_checking", "fabricated_citations", "lateral_reading"], 15, f"""
# Checking Claims and Sources

AI answers often arrive with citations, page numbers and confident wording. A citation is itself a claim: it can be wrong, or point to something that does not exist.

## Claim by claim

Do not judge an answer as a whole. Split it into **claims**, single statements that can be true or false, and check each one:

- **Supported:** the source says the same thing.
- **Contradicted:** the source says something different.
- **No real source:** the cited source, page or section cannot be found. Treat the claim as unsupported, however precise it looks.

## Try it: the campus library

In the lab, an AI answer about the library makes four claims, each with a citation. Open the sources, find the exact lines, and stamp each claim.

<sketch-lab book="ai" lesson="verify" title="Check the claims" caption="Predict first: how many of four cited claims will hold up?" />

## Lateral reading

Professional fact-checkers do not just read a page closely; they **leave it** to see what other sources say about the claim and about the source. This is called **lateral reading**. For an AI answer, that means searching for the cited source yourself, checking it exists, and reading what it actually says.

<lesson-video src="/media/ai-literacy/ClaimsVideo.mp4" title="Check claim by claim (1 min 9 s)" caption="Narrated, with captions. Predict each stamp before it lands." />

{quiz("An AI answer cites 'Smith (2021), Journal of Learning, p. 45'. You cannot find the article anywhere. What should you do with the claim?", ["Keep it; the citation looks precise.", "Treat it as unsupported and find real evidence or drop it.", "Change the year and keep it.", "Cite the chatbot instead."], 1, "fabricated_citations")}

## A routine you can reuse

1. Split the answer into claims.
2. For each important claim, find the original source yourself.
3. Check the source exists and actually says it.
4. Keep, fix or drop the claim, and cite the source, not the chatbot.
""",
        [problem("ail_303_a", "fabricated_citations", "What is a fabricated reference?",
                 ["A real source you disagree with.", "A citation to a source, page or section that does not exist.", "A source older than five years.", "A source in another language."], 1,
                 "Language models can produce plausible-looking citations that point to nothing.", "citation_means_supported"),
         problem("ail_303_b", "claim_checking", "Most claims in an AI answer check out. What about the rest?",
                 ["They are probably fine too.", "Each claim still needs checking on its own.", "Delete the whole answer.", "Ask the AI if it is sure."], 1,
                 "Accuracy on some claims says nothing certain about the others.", "mostly_right_means_right"),
         problem("ail_303_c", "lateral_reading", "What is lateral reading?",
                 ["Reading a page very slowly.", "Leaving the page to see what other sources say about the claim and the source.", "Reading only the headings.", "Reading the page sideways."], 1,
                 "Lateral reading checks claims against independent sources.", "citation_means_supported")],
        [misconception("citation_means_supported", "citation_trust", "Assuming a citation means the claim is backed up.", "learner keeps a claim because it has a reference",
                       "Check that the source exists and actually says the claim. Citations can be invented."),
         misconception("mostly_right_means_right", "halo_effect", "Trusting a whole answer because parts were right.", "learner stops checking after two correct claims",
                       "Check claim by claim. One correct claim does not vouch for the next.")])

# ---------------------------------------------------------------- Module 4: Responsible use and privacy
M4 = "Responsible Use and Privacy"

section(4, 1, M4, "Your Data Trail",
        "Trace where the parts of a prompt can travel and choose what to include and which settings to use.",
        ["Describe the places prompt data can go: the provider's servers, saved history, model training and shared links.",
         "Apply data minimization: leave out details the task does not need.",
         "Check a tool's settings and your institution's guidance before sharing sensitive material."],
        ["prompt_data_flow", "data_minimization", "settings_and_retention"], 12, f"""
# Your Data Trail

Everything you type into a chatbot leaves your device. What happens next depends on the tool, its settings and its terms. You cannot always control the second part, but you always control the first: **what you put in**.

## Where prompt data can go

- **The provider's servers:** every prompt is processed there.
- **Saved history:** many tools keep your conversations so you can return to them.
- **Model training:** some services may use conversations to improve future models unless you opt out, or unless an institutional agreement says otherwise.
- **Shared links:** sharing a conversation can make it visible to anyone who has the link.

Deleting a chat from your list may not remove every copy. Check each tool's privacy settings and documentation, and prefer tools your university has approved for coursework.

## Try it: the data trail

In the lab, choose what goes into a prompt and which settings are on, then send it and watch where each piece ends up.

<lesson-video src="/media/ai-literacy/DataTrailVideo.mp4" title="Where does your prompt go? (58 s)" caption="Narrated, with captions. Count the copies of personal details." />

<sketch-lab book="ai" lesson="privacy" title="Your data trail" caption="Predict first: if you delete the chat, where is that information now?" />

## Data minimization

**Data minimization** means sharing only what the task needs. You can get feedback on an essay without your name, student ID or health details. Replace personal details with placeholders like *[my city]* or *[classmate A]*.

Never paste:

- passwords, ID numbers or financial details;
- health or other sensitive personal information;
- other people's personal information, including classmates' work, without permission;
- confidential material from a job or internship.

{quiz("You want feedback on a cover letter. What is the safest approach?", ["Paste it as is, with your address and phone number.", "Replace personal details with placeholders, then ask for feedback.", "Paste your transcript too, for context.", "Share the chat link with your class."], 1, "data_minimization")}
""",
        [problem("ail_401_a", "prompt_data_flow", "Where does a prompt always go when you send it to a chatbot?",
                 ["Nowhere; it stays on your laptop.", "To the provider's servers for processing.", "Only to your professor.", "Directly into a public website."], 1,
                 "Prompts are processed on the provider's servers.", "chats_are_private"),
         problem("ail_401_b", "data_minimization", "What is data minimization?",
                 ["Using fewer apps.", "Sharing only the information the task needs.", "Deleting old files.", "Typing shorter prompts."], 1,
                 "Leave out details the task does not require.", "chats_are_private"),
         problem("ail_401_c", "settings_and_retention", "You delete a chat. What is true?",
                 ["Every copy is gone everywhere, guaranteed.", "Copies may still exist, depending on the provider's retention and training settings.", "The chat becomes public.", "The model forgets everything it learned."], 1,
                 "Deletion from your list may not remove all copies; check the service's policies.", "delete_means_gone")],
        [misconception("chats_are_private", "private_channel", "Believing chatbot conversations are private by default.", "learner pastes personal or confidential details",
                       "Prompts go to the provider and may be stored, used for training or shared. Leave out what is not needed."),
         misconception("delete_means_gone", "deletion_finality", "Believing deleting a chat removes it everywhere.", "learner shares sensitive data planning to delete it later",
                       "Deletion may not reach every copy. The safest protection is not to include sensitive data in the first place.")])

section(4, 2, M4, "Integrity and Disclosure",
        "Follow course AI policies, disclose AI use honestly, and keep a record of how AI contributed to your work.",
        ["Locate and apply the AI policy for a specific course.",
         "Write a clear disclosure statement describing how AI was used.",
         "Keep a simple record of prompts and changes to support honest disclosure."],
        ["course_ai_policy", "ai_disclosure", "academic_integrity"], 10, f"""
# Integrity and Disclosure

There is no single rule for AI use in college. One course may ban it, another may require it, and a third may allow it for some tasks. Integrity means following the rules of the course you are in and being honest about what you did.

## Find the policy

Look in the syllabus, the course site or the assignment instructions. If the policy is unclear, ask the instructor *before* you use AI, and keep their answer. Common policy types:

- **Not allowed:** do the work without AI tools.
- **Allowed for specific tasks:** for example, brainstorming or grammar checks, with disclosure.
- **Allowed or required with disclosure:** use is part of the assignment, and you explain it.

## Disclose clearly

A good disclosure says **what tool**, **for what**, and **what you did with the output**. For example:

> *"I used a chatbot to suggest an outline for section 2 and to check grammar. I wrote all paragraphs myself, rejected two of the suggested points because they were not supported by our readings, and verified every citation in the library database."*

## Keep a record

Save your key prompts and note what you kept or changed. A record makes disclosure easy and protects you if questions come up later.

{quiz("Which disclosure is most useful to an instructor?", ["I used AI.", "AI was used responsibly.", "I used a chatbot to brainstorm counterarguments; I chose two, rewrote them in my own words, and checked both against the course readings.", "No comment."], 2, "ai_disclosure")}

## Detectors are not proof

AI-text detectors make mistakes, including flagging human writing. If your work is questioned, your drafts, notes and AI-use record are the best evidence of your process.
""",
        [problem("ail_402_a", "course_ai_policy", "Where should you first look for the rules on AI use in a course?",
                 ["Social media.", "The syllabus, course site or assignment instructions.", "Another course's syllabus.", "The chatbot's own advice."], 1,
                 "Policies are set per course; check the course's own materials and ask if unclear.", "one_rule_everywhere"),
         problem("ail_402_b", "ai_disclosure", "What makes an AI disclosure useful?",
                 ["Saying the tool's name only.", "Stating the tool, what it was used for, and what you did with the output.", "Keeping it vague.", "Apologizing."], 1,
                 "Specific disclosures let instructors judge your process.", "vague_disclosure_is_enough"),
         problem("ail_402_c", "academic_integrity", "Why keep a record of your prompts and changes?",
                 ["To show a clear account of your process if questions arise.", "To train the AI.", "To make the work longer.", "It is never useful."], 0,
                 "A record supports honest disclosure and protects you.", "vague_disclosure_is_enough")],
        [misconception("one_rule_everywhere", "uniform_policy", "Assuming one AI rule applies to every course.", "learner applies a permissive rule from another class",
                       "AI policies vary by course and by assignment. Check each one."),
         misconception("vague_disclosure_is_enough", "token_disclosure", "Thinking 'I used AI' is enough disclosure.", "learner writes a one-word disclosure",
                       "Say what tool, for what, and what you did with the output.")])

section(4, 3, M4, "Your AI Use Plan",
        "Bring the course together in a personal AI use plan you can apply to your next assignments.",
        ["Write a personal plan for when and how you will use AI in your courses.",
         "Choose the checks you will run on AI outputs.",
         "Set your own rules for data you will not share."],
        ["ai_use_plan", "verification_habits", "transfer"], 15, f"""
# Your AI Use Plan

You now know how language models write, why data shapes who AI works for, how to ask clearly, how to check claims, and where your data goes. This last section turns that into a plan you can use next week.

## Build your plan

Write short answers to each part. Keep them practical.

1. **Tasks I will use AI for:** two or three support tasks where AI helps you and you can check the result.
2. **Tasks I will keep:** the skills your program is meant to build, which you will do yourself.
3. **How I will ask:** a template with goal, context, constraints and format.
4. **How I will check:** your routine for claims, sources, numbers and code.
5. **What I will never share:** your personal data rules.
6. **How I will disclose:** a sentence template you can adapt to each course policy.

{quiz("Which plan entry shows the strongest checking habit?", ["I trust answers that sound confident.", "For any fact or citation I use, I find the original source and confirm it says the same thing.", "I ask the chatbot if it is correct.", "I only use answers from long replies."], 1, "verification_habits")}

## Revisit it

Your plan should change as tools, courses and policies change. After each major assignment, ask:

- Did AI help with the parts I expected?
- Did my checks catch anything?
- Did I follow the course policy and disclose clearly?

## Looking back

Go back to the four 3D labs: the probability wheel, the photo model, the claim stamp and the data trail. For each one, write one sentence about what it changed in how you think about AI. That reflection is the start of your own AI literacy, which will keep growing long after this course.
""",
        [problem("ail_403_a", "ai_use_plan", "Which task fits best in 'tasks I will use AI for'?",
                 ["Writing my reflection on my own experience.", "Getting feedback on the clarity of a paragraph I wrote.", "Choosing my thesis for me.", "Taking a closed-book quiz."], 1,
                 "Feedback on your own writing is support work you can check.", "plan_is_one_time"),
         problem("ail_403_b", "verification_habits", "What is the most reliable way to check an AI-provided fact?",
                 ["Ask the AI again.", "Find the original source and confirm it says the same thing.", "Check whether the answer is long.", "Ask a friend if it sounds right."], 1,
                 "Independent, original sources are the standard for checking facts.", "ask_ai_to_verify_itself"),
         problem("ail_403_c", "transfer", "Why revisit your AI use plan after each major assignment?",
                 ["Tools, policies and your own needs change.", "Plans expire legally.", "It is required by every AI tool.", "To make it longer."], 0,
                 "Reflection keeps the plan useful as conditions change.", "plan_is_one_time")],
        [misconception("ask_ai_to_verify_itself", "self_verification", "Asking the AI whether it is correct as the only check.", "learner asks 'are you sure?' and accepts yes",
                       "A model can confidently confirm its own errors. Check independent sources."),
         misconception("plan_is_one_time", "static_plan", "Treating an AI use plan as fixed.", "learner writes the plan once and never revisits it",
                       "Revisit the plan as tools, course policies and your goals change.")])


def write():
    for s in SECTIONS:
        d = ROOT / f"{s['ch']:02d}"
        d.mkdir(parents=True, exist_ok=True)
        stem = f"{s['sec']:02d}"
        (d / f"{stem}.mdx").write_text(s["body"] + "\n", encoding="utf-8")
        meta = {"chapter_title": s["chapter_title"], "title": s["title"], "description": s["description"],
                "learning_objectives": s["objectives"], "concept_ids": s["concepts"],
                "estimated_time_minutes": s["minutes"], "order": s["sec"]}
        (d / f"{stem}.meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (d / f"{stem}.practice.json").write_text(json.dumps({"problems": s["problems"]}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        mis = {"section_id": f"ai_literacy_{s['ch']:02d}{s['sec']:02d}", "misconceptions": s["misconceptions"]}
        (d / f"{stem}.misconceptions.json").write_text(json.dumps(mis, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(SECTIONS)} sections to {ROOT}")


if __name__ == "__main__":
    write()
