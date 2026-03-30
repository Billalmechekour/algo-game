# Code Line References - Answer Validation

## 🎯 The Complete Answer Validation Chain

### Client Flow: Answer Selection & Submission

```
┌─ FlashQuestion.jsx (Lines 16-17)
│  └─ User clicks: onClick={() => !disabled && onAnswer(index.toString())}
│     └─ Sends string "0", "1", "2", etc.
│
├─ Level.jsx (Lines ~400-475): onPickChoice(choice, index)
│  └─ Store choice and index in state
│
├─ Level.jsx (Lines ~490-530): onSubmitQuestion()
│  ├─ Get answerIndex = selectedChoiceIndex (integer)
│  ├─ Get answerText = selectedChoice (text)
│  └─ Call wsSend with:
│     {
│       type: "SUBMIT_ANSWER",
│       answer: answerIndex.toString(),     ← "1"
│       answerIndex: answerIndex,            ← 1
│       answerText: answerText,              ← "String"
│       questionId, levelIndex, ...
│     }
```

---

## Server Flow: Receiving & Processing Answer

### index.js: Socket Message Handler

**Lines 780-830**: SUBMIT_ANSWER handler
```javascript
// Line 793: Extract answerIndex (convert to integer)
const parseAnswerIndex = Number.parseInt(msg.answerIndex, 10);

// Line 794: Check if valid
const hasAnswerIndex = Number.isInteger(parseAnswerIndex) && parseAnswerIndex >= 0;

// Line 795-798: Extract answerText
const answerText =
  typeof msg.answerText === "string" && msg.answerText.trim()
    ? msg.answerText
    : "";

// Line 799-802: Get raw answer
const answerRaw =
  typeof msg.answer === "string"
    ? msg.answer
    : (msg.answer == null ? "" : String(msg.answer));

// Line 803-805: Normalize (use raw if present, else use parsed index/text)
const normalizedAnswer =
  answerRaw.trim().length > 0
    ? answerRaw
    : (hasAnswerIndex ? String(parseAnswerIndex) : answerText);

// Line 806-810: Create payload for validation
const answerPayload = {
  answer: normalizedAnswer,
  answerIndex: hasAnswerIndex ? parseAnswerIndex : null,
  answerText: answerText || null,
};

// Line 812-817: Call GameManager to validate
const res = await submitAnswer(
  room.gameId,
  levelIndex,
  ws.socketId,
  msg.questionId,
  answerPayload
);

// Line 825-845: Send response with flashDebug
send(ws, {
  type: "ANSWER_RECEIVED",
  isCorrect: res.type === "FLASH"
    ? res.status === "ACCEPTED"
    : (...),
  flashDebug: res.flashDebug || null,  // ← Contains debug info!
  // ...
});
```

---

## GameManager.js: Answer Evaluation

### submitAnswer() - Lines 312-420

```javascript
// Line 313-327: Setup
export async function submitAnswer(gameId, levelIndex, playerId, questionId, answerInput) {
  const game = games.get(gameId);
  const level = game.levels[levelIndex];
  const question = level.questions.find((q) => q.id === questionId);  // ← CRITICAL LINE!

  // Line 335: Normalize the submitted answer
  const submittedAnswer = normalizeSubmittedAnswer(answerInput);

  // Line 350-372: FLASH validation
  if (question.isFlash()) {
    const flashEval = evaluateFlashAnswer(question, submittedAnswer);  // ← Calls validation
    
    // Line 355-365: Store debug info
    submission.flashDebug = {
      mode: flashEval.mode,
      receivedAnswer: submittedAnswer.answer,
      receivedAnswerIndex: submittedAnswer.answerIndex,
      receivedAnswerText: submittedAnswer.answerText || null,
      parsedIndex: flashEval.parsedIndex,
      resolvedIndex: flashEval.resolvedIndex,
      correctChoiceIndex: flashEval.correctIndex,  // ← Check this value!
      correctChoice: flashEval.correctChoice,
      normalizedAnswer: flashEval.normalizedAnswer,
      normalizedCorrectChoice: flashEval.normalizedCorrectChoice,
    };

    // Line 366: CRITICAL - Set status based on evaluation
    submission.status = flashEval.isCorrect ? "ACCEPTED" : "WRONG";
  }
  // ...
  return submission;
}
```

### evaluateFlashAnswer() - Lines 98-245 ⚠️ THE BUG IS HERE

```javascript
// Line 98-105: Function starts
function evaluateFlashAnswer(question, submittedAnswer) {
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  
  // ⚠️ LINE 101: THE CRITICAL LINE - Gets the correct answer index
  const correctIndex = Number(question?.correctChoiceIndex);
  
  const choiceCount = choices.length;

  // LINE 104-112: ⚠️ IF CORRECTINDEX IS INVALID, ALL ANSWERS MARKED WRONG
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choiceCount) {
    return {
      isCorrect: false,              // ← ALWAYS FALSE!
      mode: "invalid_question",      // ← BUG INDICATOR!
      parsedIndex: Number.isInteger(parsed) ? parsed : null,
      resolvedIndex: null,
      correctIndex: null,
      // ... other fields
    };
  }

  // LINE 124-132: Priority 1 - Explicit answerIndex (0-based)
  if (Number.isInteger(explicitAnswerIndex) && 
      explicitAnswerIndex >= 0 && 
      explicitAnswerIndex < choiceCount) {
    return {
      isCorrect: explicitAnswerIndex === correctIndex,  // ← Correct validation!
      mode: "index_explicit_0_based",
      // ... other fields
    };
  }

  // LINE 135-150: Priority 2 - Explicit answerText
  // (other validation modes...)
  
  // LINE 188-195: Priority 5 - answerIndex 0-based (backward compatibility)
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < choiceCount) {
    return {
      isCorrect: parsed === correctIndex,
      mode: "index_0_based",
      // ...
    };
  }
  
  // ...rest of validation modes
}
```

---

## Question Model: Parsing

### Question.js - Lines 72-88

```javascript
// Line 72-88: FromJSON method
static fromJSON(data) {
  const q = new Question(
    data.id,
    data.type,
    data.language,
    data.prompt,
    data.difficulty,
    data.pointsBase
  );

  // LINE 82-86: IF FLASH QUESTION
  if (data.type === "FLASH") {
    q.choices = data.choices || [];
    
    // ⚠️ LINE 84-86: If JSON doesn't have correctChoiceIndex, defaults to -1!
    q.correctChoiceIndex = Number.isInteger(data.correctChoiceIndex)
      ? data.correctChoiceIndex
      : -1;  // ← DEFAULT VALUE!
  }
  // ...
  return q;
}
```

---

## JSON Question Files

### Location: /server/src/questions/

### Examples

#### ✅ Correct Format: python_simple_flash.json (Lines 1-17)
```json
[
  {
    "id": "python_simple_flash_01",
    "type": "FLASH",
    "language": "python",
    "prompt": "Qu'affiche le code suivant?...",
    "difficulty": "SIMPLE",
    "pointsBase": 10,
    "choices": ["0 1 2", "1 2 3", "0 1 2 3", "Rien"],
    "correctChoiceIndex": 0              // ← MUST HAVE THIS!
  },
  // ... more questions
]
```

#### ✅ Correct Format: java_simple_flash.json (Lines 1-18)
```json
[
  {
    "id": "java_simple_flash_01",
    "type": "FLASH",
    "language": "java",
    "prompt": "Quelle est la méthode principale...",
    "difficulty": "SIMPLE",
    "pointsBase": 10,
    "choices": ["main()", "start()", "init()", "run()"],
    "correctChoiceIndex": 0              // ← MUST HAVE THIS!
  },
  // ... more questions
]
```

---

## Trace An Example

### Scenario: User selects choice index 1 for a Python question

```
Step 1: Client - User clicks 2nd option
  FlashQuestion.jsx:16 → onClick={() => onAnswer("1")}

Step 2: Client - onPickChoice called
  Level.jsx:~410 → onPickChoice("Some text", 1)

Step 3: Client - User clicks Submit
  Level.jsx:~503 → onSubmitQuestion()
    answerIndex = 1
    answerText = "Some text"
    wsSend({
      answer: "1",
      answerIndex: 1,
      answerText: "Some text"
    })

Step 4: Server receives message
  index.js:780 → SUBMIT_ANSWER handler
    parseAnswerIndex = 1
    hasAnswerIndex = true
    answerPayload = {
      answer: "1",
      answerIndex: 1,
      answerText: "Some text"
    }
    submitAnswer(gameId, levelIndex, playerId, questionId, answerPayload)

Step 5: Server validates
  GameManager.js:312 → submitAnswer()
    question = level.questions[0]  // Contains question data
    console.log(question.correctChoiceIndex)  // What's this value?
    
    evaluateFlashAnswer(question, answerPayload)
      → GameManager.js:98

Step 6: Validation logic
  GameManager.js:101 → const correctIndex = Number(question?.correctChoiceIndex);
  GameManager.js:104-112 → if (!Number.isInteger(correctIndex) || ...) {
                             return { isCorrect: false, mode: "invalid_question" }
                           }
  
  IF correctIndex IS VALID (e.g., 1):
    GameManager.js:124-132 → Check if answerIndex === correctIndex
                             return { isCorrect: 1 === 1, mode: "index_explicit_0_based" }
                             returns TRUE ✅

Step 7: Server sends response
  index.js:825 → send(ws, {
                   type: "ANSWER_RECEIVED",
                   isCorrect: true,  // ✅ or false ❌
                   flashDebug: { mode: "index_explicit_0_based", correctIndex: 1 }
                 })

Step 8: Client receives feedback
  Level.jsx:~90 → onMessage listener
                  sets feedbackByQuestion with isCorrect value
                  displays feedback UI
```

---

## 🔴 If Every Answer is Wrong

### Check These Lines In Order

1. **JSON File** - [server/src/questions/python_simple_flash.json](../server/src/questions/python_simple_flash.json)
   - [ ] Line 10: Does it have `"correctChoiceIndex": NUMBER`?

2. **Question Parser** - [server/src/models/Question.js](../server/src/models/Question.js#L84)
   - [ ] Is `correctChoiceIndex` being assigned from JSON data?

3. **Validation Start** - [server/src/services/GameManager.js](../server/src/services/GameManager.js#L101)
   - [ ] Add log: `console.log('correctIndex:', correctIndex);`
   - [ ] Is it -1? undefined? or a valid number (0, 1, 2, ...)?

4. **Browser Console**
   - [ ] Look for flashDebug object in ANSWER_RECEIVED
   - [ ] Is `mode: "invalid_question"`?
   - [ ] Is `correctChoiceIndex: null` or `-1`?

---

## Debug Commands

### Check JSON for correctChoiceIndex
```bash
grep -n "correctChoiceIndex" server/src/questions/*_flash.json | head
# Should see many lines with: "correctChoiceIndex": 0, 1, 2, etc.
```

### Count questions with correctChoiceIndex
```bash
grep -c '"correctChoiceIndex"' server/src/questions/*_flash.json
# Should see a high count
```

### Check if any questions MISSING correctChoiceIndex
```bash
for file in server/src/questions/*_flash.json; do
  count=$(grep -c '"correctChoiceIndex"' "$file")
  total=$(grep -c '"id"' "$file")
  if [ "$count" -ne "$total" ]; then
    echo "❌ $file: only $count/$total have correctChoiceIndex"
  else
    echo "✅ $file: all $total questions have correctChoiceIndex"
  fi
done
```
