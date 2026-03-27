const LOCAL_STORAGE_DRILL_KEY = "a+3_sstd_last_drill";
let startTime = null;
let endTime = null;
let intermediateEndTime = null;
let slowestWpmLast = { index: 0, wpm: Number.POSITIVE_INFINITY };
let consecutiveMistakes = 0;
let hadMistake = false;
let drillCompleted = false;
const drillTextMaxLength = 35;
let drillState = null;

const LOCAL_STORAGE_WORDS_KEY = "a+3_sstd_words_stats";
let currentDrillWords = [];
let possibleWord = {};
let wordStart = false;

document.addEventListener("DOMContentLoaded", () => {
    exitEditMode();
    document.querySelector("#sequenceText").maxLength = drillTextMaxLength;
    document.querySelector("#typed_text").maxLength = drillTextMaxLength;
    drillState = loadFromStorage();
    addSequenceFormElements(drillState, document.querySelector(".sequence-container"));
    addWpmStatsElements(drillState);
    document.querySelector("#typed_text").focus();

    // Restore focus on input if Enter pressed anywhere except sequence form
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const active = document.activeElement;
            const isFormInput = active.id === "sequenceText" || active.id === "wpmTarget";
            if (!isFormInput) {
                document.querySelector("#typed_text").focus();
            }
        }
    });

    document.querySelector("form[name='sequence-form']")
        .addEventListener("submit", (e) => {
            e.preventDefault();

            const drillText = e.target.sequenceText.value;
            const wpmTarget = parseInt(e.target.wpmTarget.value, 10);

            if (drillText && wpmTarget) {
                const textChanged = drillState.drillText !== drillText;
                const targetChanged = parseInt(drillState.wpmTarget, 10) !== wpmTarget;

                if (textChanged || targetChanged) {
                    drillState = buildFreshState(drillText, wpmTarget);
                    saveToStorage(drillState);
                }

                if (textChanged) {
                    addSequenceFormElements(drillState, document.querySelector(".sequence-container"));
                    addWpmStatsElements(drillState);
                } else if (targetChanged) {
                    document.querySelector("#wpm-target-value").innerHTML = wpmTarget;
                }

                exitEditMode();

                const typingInput = document.querySelector("#typed_text");
                typingInput.readOnly = false;
                typingInput.classList.remove('frozen');
                typingInput.value = "";
                startTime = null;
                endTime = null;
                consecutiveMistakes = 0;
                slowestWpmLast = { index: 0, wpm: Number.POSITIVE_INFINITY };
                intermediateEndTime = null;
                hadMistake = false;
                drillCompleted = false;
                addSequenceFormElements(drillState, document.querySelector(".sequence-container"));
                document.querySelector("#typed_text").focus();
            }
        });

    document.querySelector("#try-again-btn").addEventListener("click", () => {
        const typingInput = document.querySelector("#typed_text");
        resetDrill(typingInput);
        document.querySelector("#typed_text").focus();
    });

    const typingFormEl = document.querySelector("form[name='typing-form']");
    typingFormEl.addEventListener("keydown", startTimerOnFirstKey);
    typingFormEl.addEventListener("keydown", preventKeysResetOnEnter);
    typingFormEl.addEventListener("paste", (e) => {
        e.preventDefault();
    });
    typingFormEl.addEventListener("input", handleTypingInput);
    typingFormEl.addEventListener("mousedown", (e) => {
        const inputEl = e.target;
        if (inputEl.value.length > 0) {
            e.preventDefault();
            keepCursorAtEnd(inputEl);
        }
    });

    document.querySelector("#change-sequence-btn").addEventListener("click", () => {
        const form = document.querySelector("form[name='sequence-form']");
        form.sequenceText.value = drillState.drillText;
        form.wpmTarget.value = drillState.wpmTarget;
        enterEditMode();
    });

    document.querySelector("#cancel-btn").addEventListener("click", () => {
        exitEditMode();
        document.querySelector("#typed_text").focus();
    });


    document.querySelector("#info-btn").addEventListener("click", () => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.5); z-index:1000;
            display:flex; align-items:center; justify-content:center;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white; padding: 20px; border-radius: 8px;
            max-width: 400px; text-align: left;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;

        const image = document.createElement("img");
        image.src = "./images/sstd_last_typed.png";
        image.style.cssText = `
            max-width: 100%; 
            height: auto; 
            margin-bottom: 16px;
            transition: all 0.3s ease;
            cursor: pointer;
        `;

        // Hover effect: expand to 80% of viewport width
        image.addEventListener("mouseenter", () => {
            image.style.maxWidth = "45vw";
        });
        image.addEventListener("mouseleave", () => {
            image.style.maxWidth = "100%";
        });
        modalContent.appendChild(image);

        const text = document.createElement("p");
        text.style.cssText = "font-size: 0.9rem; color: #333; text-align: left;";
        text.innerHTML = `
            You can use <b>Enter</b> key to <b>restart the drill, instead of having to press the Try again button.</b>. <br><br>
            This small app only stores information on your browser's local storage. 
            We don't take any data from your interaction. <br><br>
            If you like the app and want to contact me for further developments, 
            please email us at <b>sstd_dev_contact@gmail.com</b>.
        `;
        modalContent.appendChild(text);

        const okButton = document.createElement("button");
        okButton.textContent = "OK";
        okButton.style.cssText = `
            margin-top: 12px; padding: 6px 16px; border:none; border-radius:4px;
            background:#28a745; color:white; cursor:pointer;
        `;
        okButton.onmouseover = () => okButton.style.backgroundColor = "#218838";
        okButton.onmouseout = () => okButton.style.backgroundColor = "#28a745";
        okButton.onclick = () => modal.remove();
        modalContent.appendChild(okButton);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    });
    document.querySelector("#settings-btn").addEventListener("click", showSettingsModal);
});

// --- Edit mode toggle ---

function enterEditMode() {
    document.querySelector(".grid-container").classList.add("edit-mode");
    document.querySelector("#sequenceText").select();
}

function exitEditMode() {
    document.querySelector(".grid-container").classList.remove("edit-mode");
}

// --- Storage helpers ---

function loadFromStorage() {
    const raw = localStorage.getItem(LOCAL_STORAGE_DRILL_KEY);
    if (raw === null) {
        return buildFreshState("sample text sequence, ", 60);
    }
    const state = JSON.parse(raw);
    // migrate old states missing new fields
    if (state.slowestWpmBest === undefined) state.slowestWpmBest = 0;
    if (state.attempts === undefined) state.attempts = 0;
    if (state.slowestWpmCharCount === undefined) state.slowestWpmCharCount = Array(state.drillText.length).fill(0);
    if (state.lastDrillWasClean === undefined) state.lastDrillWasClean = false;
    if (state.freezeAfterTwoMistakes === undefined) state.freezeAfterTwoMistakes = 0;
    if (state.showSpaceCharOnTopDrill === undefined) state.showSpaceCharOnTopDrill = 0;
    return state;
}

function saveToStorage(state) {
    localStorage.setItem(LOCAL_STORAGE_DRILL_KEY, JSON.stringify(state));
}

function buildFreshState(drillText, wpmTarget) {
    const len = drillText.length;
    return {
        drillText,
        wpmTarget,
        wpmLast: 0,
        wpmBest: 0,
        slowestWpmCharCount: Array(len).fill(0),
        slowestCharLastIndex: null,
        slowestWpmBest: 0,
        attempts: 0,
        wpmHistory: Array(10).fill(0),
        lastTypedSequence: "",
        charMistakesTotal: Array(len).fill(0),
        charMistakesLast: Array(len).fill(0),
        freezeAfterTwoMistakes: 0,
        showSpaceCharOnTopDrill: 0,
        winStreak: 0,
        lastDrillWasClean: false
    };
}

// --- UI helpers ---

function addSequenceFormElements(state, containerEL) {
    containerEL.innerHTML = "";
    const arrText = state.drillText.split("");
    for (let i = 0; i < arrText.length; i++) {
        const spanEL = document.createElement("span");
        let char = arrText[i];
        if (char === " " && state.showSpaceCharOnTopDrill === 1) {
            char = "\u2423";
            spanEL.classList.add("space-char");
        }

        spanEL.textContent = char;
        spanEL.setAttribute("id", "char-" + i);
        spanEL.classList.add("chars");
        if (i === 0) spanEL.classList.add("current");
        containerEL.appendChild(spanEL);
    }
}

function addWpmStatsElements(state) {
    // console.log(JSON.stringify(state));
    document.querySelector("#wpm-target-value").innerHTML = state.wpmTarget;
    document.querySelector("#wpm-last-value").innerHTML = state.wpmLast;
    document.querySelector("#wpm-best-value").innerHTML = state.wpmBest;
    const winStreakEl = document.querySelector("#wpm-streak-value");
    winStreakEl.innerHTML = state.winStreak;
    if (state.winStreak === 0) {
        winStreakEl.style.color = "";
        winStreakEl.style.fontWeight = "";
    } else {
        winStreakEl.style.color = "green";
        winStreakEl.style.fontWeight = "bold";

    }
    document.querySelector("#wpm-slowest-last-value").innerHTML = slowestWpmLast.wpm === Number.POSITIVE_INFINITY ? 0 : slowestWpmLast.wpm;
    document.querySelector("#wpm-slowest-best-value").innerHTML = state.slowestWpmBest;

    document.querySelector("#wpm-attempts-value").innerHTML = state.attempts;
    const successRateEl = document.querySelector("#wpm-success-rate-value");
    if (state.attempts < 10) {
        successRateEl.innerHTML = "?";
        successRateEl.style.color = "";
    } else {
        const successCount = state.wpmHistory.filter(w => w > 0).length;
        const rate = successCount * 10;
        successRateEl.innerHTML = rate + "%";
        if (rate >= 50) {
            successRateEl.style.color = "green";
        } else if (rate >= 30) {
            successRateEl.style.color = "orange";
        } else {
            successRateEl.style.color = "red";
        }
    }

    addLastTypedSequenceDataToForm(state);
}

function addLastTypedSequenceDataToForm(state) {
    if (state.lastTypedSequence.length === 0) return;

    const container = createContainerForLastTyped();

    const preCharSpan = createPreCharSpan();
    container.appendChild(preCharSpan);

    for (let i = 0; i < state.lastTypedSequence.length; i++) {
        const char = state.lastTypedSequence[i];
        const isSpace = char === " ";

        const charSpan = createCharSpan(state, i);
        const sup = createSup(state, i);
        charSpan.appendChild(sup);
        const mainChar = createMainChar(isSpace, char);
        charSpan.appendChild(mainChar);
        const sub = createSub(state, i);
        charSpan.appendChild(sub);

        container.appendChild(charSpan);
    }
}

function createContainerForLastTyped() {
    const container = document.querySelector("#wpm-last-typed-value");
    container.innerHTML = "";
    container.style.fontFamily = "monospace";
    container.style.fontSize = "0.9rem";
    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.alignItems = "flex-end";
    container.style.whiteSpace = "normal";
    return container;
}

function createPreCharSpan() {
    const preCharSpan = document.createElement("span");
    preCharSpan.style.display = "inline-flex";
    preCharSpan.style.flexDirection = "column";
    preCharSpan.style.alignItems = "center";
    preCharSpan.style.width = "16px";
    preCharSpan.style.flexShrink = "0";
    preCharSpan.style.overflow = "hidden";
    preCharSpan.style.fontWeight = "bold";

    const emptyChar = document.createElement("span");
    emptyChar.innerHTML = "&nbsp;";

    if (!drillState.lastDrillWasClean) {
        const sup = document.createElement("i");
        sup.className = "fa-solid fa-square-xmark";
        sup.style.fontSize = "0.6em";
        sup.style.lineHeight = "1";
        sup.style.color = "red";
        sup.style.marginBottom = "10px";
        preCharSpan.appendChild(sup);
        preCharSpan.appendChild(emptyChar);
        preCharSpan.appendChild(emptyChar);
    } else {
        preCharSpan.appendChild(emptyChar);
        preCharSpan.appendChild(emptyChar);
        const sub = document.createElement("i");
        sub.className = "fa-solid fa-hourglass-end";
        sub.style.fontSize = "0.45em";
        sub.style.lineHeight = "1";
        sub.style.color = "red";
        sub.style.marginTop = "-3px";
        preCharSpan.appendChild(sub);
    }
    return preCharSpan;
}

function createCharSpan(state, i) {
    const charSpan = document.createElement("span");
    charSpan.style.display = "inline-flex";
    charSpan.style.flexDirection = "column";
    charSpan.style.alignItems = "center";
    charSpan.style.width = "16px";
    charSpan.style.flexShrink = "0";
    charSpan.style.overflow = "hidden";
    charSpan.style.fontWeight = "bold";
    charSpan.style.color = state.charMistakesLast[i] === 1 ? "red" : "green";
    return charSpan;
}

function createSup(state, i) {
    const sup = document.createElement("span");
    sup.style.fontSize = "0.6em";
    sup.style.lineHeight = "1";
    sup.style.width = "100%";
    sup.style.textAlign = "center";
    sup.style.overflow = "hidden";
    sup.textContent = state.charMistakesTotal[i] > 0 ? state.charMistakesTotal[i] : "\u00A0";
    return sup;
}

function createMainChar(isSpace, char) {
    const mainChar = document.createElement("span");
    mainChar.textContent = isSpace ? "\u2423" : char;
    mainChar.style.width = "100%";
    mainChar.style.textAlign = "center";
    mainChar.style.overflow = "hidden";
    mainChar.style.display = "block";
    return mainChar;
}

function createSub(state, i) {
    const sub = document.createElement("span");
    sub.style.fontSize = "0.6em";
    sub.style.lineHeight = "1";
    sub.style.width = "100%";
    sub.style.textAlign = "center";
    sub.style.overflow = "hidden";
    sub.style.color = (state.slowestCharLastIndex === i) ? "red" : "green";
    sub.textContent = state.slowestWpmCharCount[i] > 0 ? state.slowestWpmCharCount[i] : "\u00A0";
    return sub;
}

function showCongratulationsModal(message, okLabel) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;';

    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'position: fixed; top: 8%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 1px solid #ccc; z-index: 1001; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); min-width: 280px;';

    const messageP = document.createElement('p');
    messageP.textContent = message;
    messageP.style.marginBottom = '20px';
    messageP.style.textAlign = 'center';
    messageP.style.fontWeight = 'bold';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; justify-content: center; width: 100%;';

    const okButton = document.createElement('button');
    okButton.textContent = okLabel;
    okButton.style.cssText = 'background-color: #28a745; color: white; border: none; padding: 8px 24px; border-radius: 4px; cursor: pointer; font-size: 1rem;';
    okButton.onmouseover = () => okButton.style.backgroundColor = '#218838';
    okButton.onmouseout = () => okButton.style.backgroundColor = '#28a745';
    okButton.onclick = () => {
        drillState.winStreak = 0;
        saveToStorage(drillState);
        document.querySelector("#wpm-streak-value").innerHTML = 0;
        modal.remove();
    };

    buttonContainer.appendChild(okButton);
    modalContent.appendChild(messageP);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

function showSettingsModal() {

    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top:0;
        left:0;
        width:100%;
        height:100%;
        background: rgba(0,0,0,0.5);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:1000;
    `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
        background:white;
        padding:28px;
        border-radius:8px;
        min-width:320px;
        display:flex;
        flex-direction:column;
        justify-content:center;
    `;

    const title = document.createElement("h5");
    title.textContent = "Settings";
    title.style.marginBottom = "10px";
    title.style.textAlign = "center";

    // First toggle - Freeze after mistakes
    const formCheck1 = document.createElement("div");
    formCheck1.className = "form-check form-switch";
    formCheck1.style.cssText = `
        display:flex;
        align-items:center;
        gap:12px;
        margin-top:18px;
        margin-bottom:18px;
    `;

    const freezeToggle = document.createElement("input");
    freezeToggle.className = "form-check-input";
    freezeToggle.type = "checkbox";
    freezeToggle.id = "freeze-toggle";
    freezeToggle.checked = drillState.freezeAfterTwoMistakes === 1;
    freezeToggle.style.transform = "scale(1.4)";
    freezeToggle.style.cursor = "pointer";

    const freezeLabel = document.createElement("label");
    freezeLabel.className = "form-check-label";
    freezeLabel.setAttribute("for", "freeze-toggle");
    freezeLabel.textContent = "Freeze typing after 2 consecutive mistakes";
    freezeLabel.style.margin = "0";
    freezeLabel.style.cursor = "pointer";

    formCheck1.appendChild(freezeToggle);
    formCheck1.appendChild(freezeLabel);

    // Second toggle - Show space character
    const formCheck2 = document.createElement("div");
    formCheck2.className = "form-check form-switch";
    formCheck2.style.cssText = `
        display:flex;
        align-items:center;
        gap:12px;
        margin-top:18px;
        margin-bottom:18px;
    `;

    const spaceToggle = document.createElement("input");
    spaceToggle.className = "form-check-input";
    spaceToggle.type = "checkbox";
    spaceToggle.id = "space-toggle";
    spaceToggle.checked = drillState.showSpaceCharOnTopDrill === 1; // Fixed this line
    spaceToggle.style.transform = "scale(1.4)";
    spaceToggle.style.cursor = "pointer";

    const spaceLabel = document.createElement("label");
    spaceLabel.className = "form-check-label";
    spaceLabel.setAttribute("for", "space-toggle");
    spaceLabel.textContent = "Show \u2423 instead of empty space on top drill";
    spaceLabel.style.margin = "0";
    spaceLabel.style.cursor = "pointer";

    formCheck2.appendChild(spaceToggle);
    formCheck2.appendChild(spaceLabel);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        margin-top:20px;
        display:flex;
        justify-content:space-between;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => modal.remove();

    const okBtn = document.createElement("button");
    okBtn.className = "btn btn-primary";
    okBtn.textContent = "Save";

    okBtn.onclick = () => {
        drillState.freezeAfterTwoMistakes = freezeToggle.checked ? 1 : 0;
        drillState.showSpaceCharOnTopDrill = spaceToggle.checked ? 1 : 0;
        saveToStorage(drillState);
        addSequenceFormElements(drillState, document.querySelector(".sequence-container"));
        modal.remove();
    };

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(okBtn);

    modalContent.appendChild(title);
    modalContent.appendChild(formCheck1);
    modalContent.appendChild(formCheck2);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// --- Typing logic ---

function startTimerOnFirstKey(e) {
    if (startTime === null && e.key !== "Enter" && e.key !== "Shift") startTime = Date.now();
}

function handleTypingInput(e) {
    const typedText = e.target.value;
    const typeTextLength = typedText.length;
    if (typeTextLength === 0) return;
    const lastTypedIndex = typeTextLength - 1;
    
    console.log(`I'm here what's up`);

    /* CHEKC IF IS A WORD AND SAVE CHARS AND INDEXES SEQUENCES */
    // 1. START of a word (First character)
    if (!wordStart && typedText[lastTypedIndex] !== ' ') {
        wordStart = true;
        possibleWord = {
            charsSequence: [typedText[lastTypedIndex]],
            indexsSequnce: [lastTypedIndex]
        };
    } 
    // 2. MIDDLE of a word (Not a space, and word already started)
    else if (wordStart && typedText[lastTypedIndex] !== ' ') {
        possibleWord.charsSequence.push(typedText[lastTypedIndex]);
        possibleWord.indexsSequnce.push(lastTypedIndex);
    }

    // 3. END of a word (Space detected OR end of the whole drill string)
    const isEndOfDrill = typeTextLength === drillState.drillText.length;
    if (wordStart && (typedText[lastTypedIndex] === ' ' || isEndOfDrill)) {
        wordStart = false;
        currentDrillWords.push(possibleWord);
        possibleWord = {}; // Reset for the next word
    }    
    if (!wordStart && typedText[lastTypedIndex] !== ' ') {
        wordStart = true;
        possibleWord.charsSequence = [];
        possibleWord.indexsSequnce = [];
        possibleWord.charsSequence.push(typedText[lastTypedIndex]);
        possibleWord.indexsSequnce.push(lastTypedIndex);
    } else if (wordStart && typedText[lastTypedIndex] === ' ' && possibleWord.charsSequence.length > 0) {
        wordStart = false;
        currentDrillWords.push(possibleWord);
    }

    console.log(`Current Char: ${currentChar} | WordStart: ${wordStart}`);
    if (!wordStart && currentDrillWords.length > 0) {
        const lastWord = currentDrillWords[currentDrillWords.length - 1];
        console.log("Captured Word:", lastWord.charsSequence.join(""), "Indices:", lastWord.indexsSequnce);
    }

    const currentSpan = document.getElementById(`char-${lastTypedIndex}`);
    const nextSpan = document.getElementById(`char-${lastTypedIndex + 1}`);
    if (currentSpan) currentSpan.classList.remove('current');
    if (nextSpan) nextSpan.classList.add('current');

    if (typedText[lastTypedIndex] === drillState.drillText[lastTypedIndex]) {
        currentSpan.classList.add('correct');
        currentSpan.classList.remove('incorrect');
        drillState.charMistakesLast[lastTypedIndex] = 0;
        consecutiveMistakes = 0;
        endTime = Date.now();

        if (lastTypedIndex === 0) {
            intermediateEndTime = endTime;
        } else {
            const wpmIntermediate = calculateWPM(1, intermediateEndTime, endTime);
            if (wpmIntermediate < slowestWpmLast.wpm) {
                slowestWpmLast.index = lastTypedIndex;
                slowestWpmLast.wpm = wpmIntermediate;
            }
            intermediateEndTime = endTime;
        }
    } else {
        currentSpan.classList.add('incorrect');
        currentSpan.classList.remove('correct');
        drillState.charMistakesLast[lastTypedIndex] = 1;
        drillState.charMistakesTotal[lastTypedIndex] += 1;
        consecutiveMistakes += 1;
        hadMistake = true;
    }

    // 2+ consecutive mistakes — possibility of freezing if fail
    if (consecutiveMistakes >= 2 && drillState.freezeAfterTwoMistakes === 1) {
        slowestWpmLast = { index: 0, wpm: Number.POSITIVE_INFINITY };
        drillState.wpmLast = 0;
        drillState.wpmHistory.shift();
        drillState.wpmHistory.push(0);
        drillState.winStreak = 0;
        drillState.attempts += 1;
        drillState.lastTypedSequence = typedText;
        drillState.lastDrillWasClean = false;
        saveToStorage(drillState);
        e.target.readOnly = true;
        e.target.classList.add('frozen');
        addWpmStatsElements(drillState);
        keepCursorAtEnd(e.target);
        return;
    }

    if (typeTextLength === drillState.drillText.length) {
        // reached end with any mistake — freeze as fail
        if (hadMistake) {
            drillState.wpmLast = 0;
            slowestWpmLast = { index: 0, wpm: Number.POSITIVE_INFINITY };
            drillState.wpmHistory.shift();
            drillState.wpmHistory.push(0);
            drillState.winStreak = 0;
            drillState.attempts += 1;
            drillState.lastTypedSequence = typedText;
            drillState.lastDrillWasClean = false;
            saveToStorage(drillState);
            e.target.readOnly = true;
            e.target.classList.add('frozen');
            addWpmStatsElements(drillState);
            keepCursorAtEnd(e.target);
            return;
        }

        // clean finish — freeze with wpm
        drillState.slowestWpmCharCount[slowestWpmLast.index] += 1;
        if (slowestWpmLast.wpm > drillState.slowestWpmBest) {
            drillState.slowestWpmBest = slowestWpmLast.wpm;
        }

        const wpm = calculateWPM(typeTextLength, startTime, endTime);
        drillState.wpmLast = wpm;
        drillState.wpmHistory.shift();
        drillState.wpmHistory.push(wpm);
        drillState.lastTypedSequence = typedText;
        if (wpm > drillState.wpmBest) drillState.wpmBest = wpm;
        drillState.winStreak = wpm >= drillState.wpmTarget ? drillState.winStreak + 1 : 0;
        drillState.attempts += 1;
        drillState.lastDrillWasClean = true;
        drillState.slowestCharLastIndex = slowestWpmLast.index;
        saveToStorage(drillState);
        drillCompleted = true;
        e.target.readOnly = true;
        e.target.classList.add('frozen');
        addWpmStatsElements(drillState);
        keepCursorAtEnd(e.target);

        // Delay modal so the Enter keydown event doesn't instantly dismiss it
        const successCount = drillState.wpmHistory.filter(w => w > 0).length;
        const rate = successCount * 10;
        // console.log('state wpm history length ', drillState.wpmHistory.length);
        if (drillState.winStreak >= 3 && drillState.attempts >= 10 && rate >= 50) {
            setTimeout(() => showCongratulationsModal(
                `🎉 ${drillState.winStreak} wins in a row and ${rate}% success rate on the last 10 attempts. Keep it up!`,
                'OK'
            ), 50);
        }

        return;
    }
}

function keepCursorAtEnd(inputEl) {
    const len = inputEl.value.length;
    inputEl.selectionStart = len;
    inputEl.selectionEnd = len;
}

function preventKeysResetOnEnter(e) {
    if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
    ) {
        e.preventDefault();
    } else if (e.key === "Enter") {
        e.preventDefault();
        const typingInput = document.querySelector("#typed_text");
        if (typingInput.value.length > 0) {
            if (!drillCompleted) {
                // abandoned mid-drill — record as fail
                drillState.wpmLast = 0;
                drillState.wpmHistory.shift();
                drillState.wpmHistory.push(0);
                drillState.winStreak = 0;
                drillState.attempts += 1;
                drillState.lastTypedSequence = typingInput.value;
                drillState.lastDrillWasClean = false;
                saveToStorage(drillState);
            }
            resetDrill(typingInput);
        }
    }
}

function resetDrill(inputEl) {
    drillCompleted = false;
    hadMistake = false;
    inputEl.readOnly = false;
    inputEl.classList.remove('frozen');
    inputEl.value = "";
    startTime = null;
    endTime = null;
    consecutiveMistakes = 0;
    slowestWpmLast = { index: 0, wpm: Number.POSITIVE_INFINITY };
    intermediateEndTime = null;

    addSequenceFormElements(drillState, document.querySelector(".sequence-container"));
    addWpmStatsElements(drillState);

    drillState.charMistakesLast = Array(drillState.drillText.length).fill(0);
    saveToStorage(drillState);

    keepCursorAtEnd(inputEl);
}

function calculateWPM(typeTextLength, startTime, endTime) {
    // Formula: wpm = (charTyped / 5) * (60 / timeInSeconds)
    const timeInSeconds = (endTime - startTime) * 0.001;
    const wpm = (typeTextLength / 5) * (60 / timeInSeconds);
    return Math.round(wpm);
}