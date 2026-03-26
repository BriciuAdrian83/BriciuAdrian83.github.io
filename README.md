# Small Sequence Typing Drill (SSTD)

![App Screenshot](image/small_sequence_typing_drill/1773083365440.png)

## Description
**SSTD** is a lightweight, browser-based web app to help you practice typing speed and accuracy. It uses **local storage** to save a single short typing sequence (max 35 characters), making it fast, private, and easy to use.  

You can test your typing performance, track your WPM, and identify mistakes in real time, without any server or external data collection.

---

## Features

- **Local Storage**
  - Stores the last typing drill at key `"a+3_sstd_last_drill"` in JSON format.
  
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

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/small-sequence-typing-drill.git

   - Open `index.html` in your browser.  
- Optional: Deploy via **GitHub Pages** to share the app publicly.  

## Usage

1. Type the sequence displayed in the drill box.  
2. The **current character** is highlighted for guidance.  
3. Mistakes are tracked, and consecutive errors freeze the typing box.  
4. Press **Enter** to restart at any time (or press try again button).  
5. Observe your **WPM and streaks** in real time.  

## Future Improvements

- Maintain a **drill list** with multiple sequences.  
- Track **last practiced date** and success rate per drill.  
- Add **progress visualization** (charts for WPM history, streaks, and accuracy). 
- Last typed sequence have useful data for (see ![App Screenshot](image/small_sequence_typing_drill/1773083365440.png)):
  - improving on mistakes, the last chars typed that represents mistakes in the last typing session are marked red above and total no. of mistakes (cumulative) are shown.
  - improving on slow char, the slowest char on the last try is shown in red and count of slowest (cumulative) chars are also noted.

## License

This project is open-source and free to use.  

For feedback, suggestions, or development inquiries, contact: **sstd_dev_contact@gmail.com**


# Word stats analysis development
## Current drill data (one sequence)
```JS
{
  "driLLtEXT":" citizens own responsibilities ",
  "wpmTarget":75,
  "wpmLast":67,
  "wpmBest":78,
  "slowestWpmCharCount":[0,2,0,0,0,1,1,0,0,0,0,0,0,1,0,0,0,0,1,0,1,0,0,0,4,0,6,6,0,0,1],
  "slowestCharLastIndex":18,
  "slowestWpmBest":37,
  "attempts":54,
  "wpmHistory":[0,74,0,0,59,0,0,69,69,67],
  "lastTypedSequence":" citizens own responsibilities ",
  "charMistakesTotal":[0,0,0,0,0,2,0,1,1,1,1,2,3,2,0,0,1,0,7,2,2,1,2,2,2,0,1,6,4,2,2],
  "charMistakesLast":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  "freezeAfterTwoMistakes":0,
  "showSpaceCharOnTopDrill":0,
  "winStreak":0,
  "lastDrillWasClean":true
}
```
## Data that will be calculated for words stats

```JS
{
  "word": "responsibilities",
  "accuracy": {
    "score": 0.0416,
    "worstIndexes": [5, 12] // The specific characters with the MAX mistakes
  },
  "speed": {
    "score": 0.0219,
    "worstIndexes": [18]    // The specific character with the MAX slow count
  }
}
``` 

## Calculation of scores 

Calculation only starts when attempts > 10


1. The Accuracy Score (Mistake Density)This formula calculates the probability of making a mistake on any given character within that specific word.$$\text{Accuracy Score} = \frac{\sum \text{Mistakes in Word}}{\text{Word Length} \times \text{Total Drills}}$$


2. The Speed Score (Hesitation Density)This uses your slowestWpmCharCount to find where your rhythm breaks, even if you didn't actually press the wrong key.$$\text{Speed Score} = \frac{\sum \text{Slow Counts in Word}}{\text{Word Length} \times \text{Total Drills}}$$

## User Interface result presentation
In a modal 2 categories of top wors wors words will be shown:
- top 4 words with worst accuracy
- top 4 words with worst typing speed
A word could be in both categorie, high score is a bad result, that is words with the highest scores will compose the top 4.