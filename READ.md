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