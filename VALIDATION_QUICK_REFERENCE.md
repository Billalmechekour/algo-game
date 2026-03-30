# Answer Validation - Quick Debug Checklist

## 🔍 Where Questions & Answers are Displayed

### Client-Side Display
| Component | File | Purpose |
|-----------|------|---------|
| **FlashQuestion** | [client/src/components/FlashQuestion.jsx](../client/src/components/FlashQuestion.jsx) | Displays FLASH question with multiple choice buttons. User clicks index 0, 1, 2, etc. |
| **CodeEditor** | [client/src/components/CodeEditor.jsx](../client/src/components/CodeEditor.jsx) | Displays CODE question with textarea for code input |
| **Level Screen** | [client/src/screens/Level.jsx](../client/src/screens/Level.jsx) | Main game screen. Manages question display, answer submission, feedback |
| **QuestionNavigation** | [client/src/components/QuestionNavigation.jsx](../client/src/components/QuestionNavigation.jsx) | Shows which questions are answered (progress bar at bottom) |

### Server-Side Question Loading
| Component | File | Purpose |
|-----------|------|---------|
| **Question Model** | [server/src/models/Question.js](../server/src/models/Question.js) | Question class with `correctChoiceIndex` field |
| **QuestionBank** | [server/src/services/QuestionBank.js](../server/src/services/QuestionBank.js) | Loads questions from JSON files and parses them |
| **GameManager** | [server/src/services/GameManager.js](../server/src/services/GameManager.js) | Creates games with questions, validates answers |
| **JSON Question Files** | [server/src/questions/](../server/src/questions/) | Question data with `correctChoiceIndex` |

---

## ✅ Answer Validation Check Points

### 1️⃣ Question JSON Files
**Location**: [server/src/questions/](../server/src/questions/)

**What to check**:
```bash
# Should see correctChoiceIndex in all FLASH questions
grep -n "correctChoiceIndex" server/src/questions/*_flash.json | head -20
```

**Expected format**:
```json
{
  "id": "java_simple_flash_01",
  "type": "FLASH",
  "prompt": "Question text?",
  "choices": ["Option 1", "Option 2", "Option 3"],
  "correctChoiceIndex": 0    ← Should be 0, 1, 2, or 3
}
```

**If missing**: JSON files don't have correctChoiceIndex → BUG!

---

### 2️⃣ Question.fromJSON() Parsing
**Location**: [server/src/models/Question.js](../server/src/models/Question.js#L72)

**Code**:
```javascript
static fromJSON(data) {
  const q = new Question(...);
  if (data.type === "FLASH") {
    q.choices = data.choices || [];
    q.correctChoiceIndex = Number.isInteger(data.correctChoiceIndex)
      ? data.correctChoiceIndex
      : -1;  // ← If missing from JSON, becomes -1!
  }
  return q;
}
```

**What to check**:
- Does JSON have `correctChoiceIndex` field?
- Is it a valid integer (0, 1, 2...)?
- Is parser correctly assigning it?

---

### 3️⃣ QuestionBank Loading
**Location**: [server/src/services/QuestionBank.js](../server/src/services/QuestionBank.js#L39)

**Code**:
```javascript
static loadQuestions(language, difficulty, questionType) {
  const data = fs.readFileSync(filePath, "utf-8");
  const questions = JSON.parse(data).map((q) => Question.fromJSON(q));
  //                                       ↑ Questions created here
  return questions;
}
```

**What to check**:
- Is this method being called correctly?
- Are Question objects properly created?
- Do they have correctChoiceIndex set?

---

### 4️⃣ Game Creation & Question Storage
**Location**: [server/src/services/GameManager.js](../server/src/services/GameManager.js#L260)

**Code**:
```javascript
export function createGame(room) {
  for (let i = 0; i < levelCount; i++) {
    const level = new Level(i, difficulty, room.config.timePerLevelSec);
    level.questions = QuestionBank.selectRandomQuestions(...);
    //                ↑ Questions with correctChoiceIndex stored here
    game.levels.push(level);
  }
}
```

**What to check**:
- Are questions loaded with correctChoiceIndex?
- Are they stored in level.questions?

---

### 5️⃣ Answer Processing (Client → Server)
**Location**: [server/src/index.js](../server/src/index.js#L780)

**Flow**:
```
Client sends:  { answer: "1", answerIndex: 1, answerText: "String" }
              ↓
Server parses: parseAnswerIndex = 1, hasAnswerIndex = true
              ↓
Creates:      answerPayload = { answer: "1", answerIndex: 1, answerText: "String" }
              ↓
Calls:        submitAnswer(gameId, levelIndex, playerId, questionId, answerPayload)
```

---

### 6️⃣ Answer Validation (The Critical Check)
**Location**: [server/src/services/GameManager.js](../server/src/services/GameManager.js#L98)

**CODE**:
```javascript
function evaluateFlashAnswer(question, submittedAnswer) {
  const choices = question.choices || [];
  const correctIndex = Number(question?.correctChoiceIndex);  // ← CRITICAL!
  const choiceCount = choices.length;

  // ⚠️ IF CORRECTINDEX IS INVALID, ALL ANSWERS MARKED WRONG
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choiceCount) {
    return { isCorrect: false, mode: "invalid_question" };  // ← BUG SIGN!
  }

  // If we get here, validation proceeds normally
  if (Number.isInteger(submittedAnswer?.answerIndex)) {
    return {
      isCorrect: submittedAnswer.answerIndex === correctIndex,
      mode: "index_explicit_0_based"
    };
  }
}
```

**What to check**:
- Is `question.correctChoiceIndex` a valid number (0, 1, 2...)?
- Or is it -1, null, undefined?

---

### 7️⃣ Debug Information Sent to Client
**Location**: [server/src/index.js](../server/src/index.js#L825)

**Response**:
```javascript
send(ws, {
  type: "ANSWER_RECEIVED",
  isCorrect: res.status === "ACCEPTED",
  flashDebug: res.flashDebug || null,  // ← Contains debugging info!
  // ...
});
```

**flashDebug object** (from GameManager.js):
```javascript
submission.flashDebug = {
  mode: "index_explicit_0_based",      // OR "invalid_question" ← BUG IF THIS!
  receivedAnswer: "1",
  receivedAnswerIndex: 1,
  receivedAnswerText: "String",
  correctChoiceIndex: 1,               // ← Should be 0, 1, 2, etc.
  correctChoice: "String",             // ← Expected choice text
  normalizedAnswer: "1",
  normalizedCorrectChoice: "string"    // ← Normalized comparison
};
```

---

## 🐛 Bug Detection

### Sign #1: Every Answer Marked Wrong
**Root cause**: `question.correctChoiceIndex` is invalid (-1, null, undefined)

### Sign #2: flashDebug Shows
```json
{
  "mode": "invalid_question",
  "correctChoiceIndex": null,
  "correctChoice": undefined
}
```
**Meaning**: The question object doesn't have a valid `correctChoiceIndex`

### Sign #3: flashDebug Shows
```json
{
  "mode": "index_explicit_0_based",
  "correctChoiceIndex": -1,
}
```
**Meaning**: Question was created with `correctChoiceIndex = -1` (default when missing from JSON)

---

## 🔧 Debugging Steps

### Step 1: Check the Browser Console
When you submit an answer, look for the `ANSWER_RECEIVED` message payload:
```javascript
// In browser DevTools → Network → WebSocket messages
{
  "type": "ANSWER_RECEIVED",
  "isCorrect": false,
  "flashDebug": {
    "mode": "invalid_question",     // ← Is this showing?
    "correctChoiceIndex": ???        // ← What's this value?
  }
}
```

### Step 2: Check the Server Logs
Add logging to [server/src/services/GameManager.js](../server/src/services/GameManager.js#L330):

```javascript
if (question.isFlash()) {
  console.log(`[DEBUG] Question: ${question.id}`);
  console.log(`  correctChoiceIndex: ${question.correctChoiceIndex}`);
  console.log(`  choices: ${JSON.stringify(question.choices)}`);
  console.log(`  submittedAnswer: ${JSON.stringify(submittedAnswer)}`);
  
  const flashEval = evaluateFlashAnswer(question, submittedAnswer);
  console.log(`  flashEval.mode: ${flashEval.mode}`);
  console.log(`  isCorrect: ${flashEval.isCorrect}`);
}
```

### Step 3: Verify JSON Files
```bash
# Check if correctChoiceIndex exists
grep -c "correctChoiceIndex" server/src/questions/*_flash.json

# Should output a number > 0 for each file
```

### Step 4: Test Question.fromJSON()
In [server/src/services/QuestionBank.js](../server/src/services/QuestionBank.js), add:
```javascript
const questions = JSON.parse(data).map((q) => {
  const parsed = Question.fromJSON(q);
  if (parsed.type === "FLASH") {
    console.log(`Loaded: ${parsed.id} → correctChoiceIndex=${parsed.correctChoiceIndex}`);
  }
  return parsed;
});
```

---

## ✨ Summary

| Component | What It Does | Where to Check |
|-----------|-------------|-----------------|
| **Client** | Displays questions, sends answers | [client/src/screens/Level.jsx](../client/src/screens/Level.jsx) |
| **Server Reception** | Parses answer payload | [server/src/index.js](../server/src/index.js#L780) |
| **Validation** | Compares answer to correctChoiceIndex | [server/src/services/GameManager.js](../server/src/services/GameManager.js#L98) |
| **Questions** | Have correctChoiceIndex | [server/src/questions/](../server/src/questions/) JSON files |
| **Parsing** | Question.fromJSON() | [server/src/models/Question.js](../server/src/models/Question.js) |

**🎯 THE BUG IS HERE**: When `question.correctChoiceIndex` is invalid or missing, `evaluateFlashAnswer()` returns `mode: "invalid_question"` and marks the answer as WRONG.
