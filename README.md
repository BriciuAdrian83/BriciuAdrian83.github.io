# Small Sequence Typing Drill (SSTD)

![App Screenshot](./images/sstd_last_typed.png)

## Description
**SSTD** is a lightweight, browser-based web app to help you practice typing speed and accuracy. It uses **local storage** to save a single short typing sequence (max 35 characters), making it fast, private, and easy to use.  

You can test your typing performance, track your WPM, and identify mistakes in real time, without any server or external data collection.

---

## Features
- **Local Storage**
  - Stores the last typing drill at key `"a+3_sstd_last_drill"` in JSON format.
  - Stores the word stat data (accuracy and speed) at key `a+3_sstd_words_stats`.
    - also stores drill history queue in order for reusing previous drills
  
- **Default Sequence**
  - If no previous sequence is found in storage, the default drill is:
    ```
    "sample text sequence, "
    ```
  
- **Stored Drill Data Structure**
  ```json
  {
    "drill_text": "sample text sequence, ",
    "wpm_last": 0,
    "wpm_best": 0,
    "wpm_history": [60, 75, ...],
    "last_typed_sequence": "text typed",
    "char_mistakes": [0, 0, 0, 1, 1, 0, ...]
  }
  ```
  ## Typing Rules
- Backspace and Delete keys are **disabled**.  
- Pressing **Enter** immediately restarts the drill.  
- Timer starts on the **first key press** and stops on the **last key press**.  
- Also intermediate timers are checked for measuring next char typing speed starting from the second character.
- If any mistake occurs, `wpm_last` is recorded as 0.  
- The current character is highlighted visually.  
- Typing advances even when a mistake is made.  
- On the settings there is a option to   freeze the typing box after 2 consecutive mistakes until Enter is pressed (also try again button will unfreeze.).

## Target WPM
- Input a target WPM for each drill.  
- If at least 3 consecutive attempts meet or exceed the target and success rate is above 50%, with at least 10 attempts completed, congratulation indicator is displayed.  

## Word stats analysis development

### Data that will be calculated for words stats

```JS
{
  "accuracyQueue": [
    { "word": "responsibilities", "score": -1.0416, "worstIndexes": [5, 12] },
    { "word": "citizens", "score": -1.0310, "worstIndexes": [2] }
    // ... top 19 worst accuracy words
  ],
  "speedQueue": [
    { "word": "own", "score": -1.0820, "worstIndexes": [1] },
    { "word": "responsibilities", "score": -1.0219, "worstIndexes": [18] }
    // ... top 19 worst speed words
  ]
}
``` 

### Calculation of scores 
Calculation only starts when attempts >= 10 for the accuracy and attemptsClean >= 5

0. The Accuracy Score (Mistake Density)This formula calculates the probability of making a mistake on any given character within that specific word.$$\text{Accuracy Score} = \frac{\sum \text{Mistakes in Word}}{\text{Word Length} \times \text{Total Drills}}$$
1. 
2. The Speed Score (Hesitation Density)This uses your slowestWpmCharCount to find where your rhythm breaks, even if you didn't actually press the wrong key.$$\text{Speed Score} = \frac{\sum \text{Slow Counts in Word}}{\text{Word Length} \times \text{Total Clean Drills}}$$

### User Interface result presentation
In a modal 1 categories of top words will be shown:
- top 4 words with worst accuracy
- top 4 words with worst typing speed
A word could be in both categorie, high score is a bad result, that is words with the highest scores will compose the top 4.

## Installation
1. Clone the repository:
```bash
git clone https://github.com/yourusername/small-sequence-typing-drill.git
```
- Open `index.html` in your browser.  
- Optional: Deploy via **GitHub Pages** to share the app publicly.  

## Usage
1. Type the sequence displayed in the drill box.  
2. The **current character** is highlighted for guidance.  
3. Mistakes are tracked, and consecutive errors freeze the typing box.  
4. Press **Enter** to restart at any time (or press try again button).  
5. Observe your **WPM and streaks** in real time.  

## Change / History Drill Improvements
1. OverviewThis document defines the persistent data structure and logic for the Super Simple Typing Drill (SSTD) history system. This system allows users to save custom drill sequences, track their mastery over time, and use Spaced Repetition (SRS) to optimize muscle memory.
2. Storage KeyAll data is stored in the browser's localStorage:Key: a+3_sstd_words_statsFormat: JSON Object containing an array named historyQueue
3. Data Schema (The Drill Object)Each entry in the historyQueue follows this structure:PropertyTypeDescriptiondrillTextStringThe unique text sequence. Used as the unique identifier for lookups.wpmTargetNumberThe specific WPM goal set for this drill.createdAtNumberUnix timestamp (ms) of when the drill was first created.succeededTimesNumberIncrements each time the "Mastery" criteria is met.nextReviewAtNumber | nullThe calculated Unix timestamp for the next scheduled practice session.
Example JSON
```JSON
{
  "drillText": "yet another one drill time",
  "wpmTarget": 75,
  "createdAt": 1774935009192,
  "succeededTimes": 1,
  "nextReviewAt": 1775280609192
}
```
4. Operational LogicA. Saving Drills (addToDrillHistory)Condition: Triggered on form submission if the text does not already exist in history.Duplicate Check: Uses findHistoryDrillIndex to perform a reverse-search of the array.Safety: Automatically initializes the historyQueue array if it is missing from storage.B. Updating Targets (updateDrillHistoryWpmTarget)Condition: Triggered if the user changes the WPM target for a text sequence already present in the history.Action: Updates the wpmTarget value without resetting success counts or timestamps.C. Spaced Repetition Math (updateDrillHistoryNextReviewOnSucceed)Trigger: Fired when the user achieves a 3-win streak with a 50% success rate over the last 10 attempts.The Formula:$NextReview = CurrentTime + (4 \text{ days} \times succeededTimes)$Conversion: $4 \text{ days} = 345,600,000 \text{ milliseconds}$.
5. Planned UI EnhancementsWith this data structure in place, the following filters are supported for the upcoming Select2 implementation:Today: Filter by createdAt matching today's date.Spaced (Due): Filter by nextReviewAt <= Date.now().All: Display the full historyQueue.

## License
This project is open-source and free to use.  
For feedback, suggestions, or development inquiries, contact: **sstd.dev.contact@gmail.com**


