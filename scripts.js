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
                    addToDrillHistory(drillText, wpmTarget);
                } else if (targetChanged) {
                    document.querySelector("#wpm-target-value").innerHTML = wpmTarget;
                    updateDrillHistoryWpmTarget(drillText, wpmTarget);
                }

                exitEditMode();

                const typingInput = document.querySelector("#typed_text");
                typingInput.readOnly = false;
                typingInput.classList.remove('frozen');
                typingInput.value = "";

                currentDrillWords = [];
                possibleWord = {};
                wordStart = false;

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
        enterEditMode();
        resetSequenceForm();
    });

    document.querySelector("#cancel-btn").addEventListener("click", () => {
        exitEditMode();
        resetSequenceForm();
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

    document.querySelector("#stats-btn").addEventListener("click", () => {
        const statsRaw = localStorage.getItem(LOCAL_STORAGE_WORDS_KEY);
        const stats = statsRaw ? JSON.parse(statsRaw) : { accuracyQueue: [], speedQueue: [] };

        // GATES: Based on README.md requirements
        const hasEnoughAccuracy = drillState.attempts >= 10 && stats.accuracyQueue.length > 0;
        const hasEnoughSpeed = drillState.attemptsClean >= 5 && stats.speedQueue.length > 0;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.6); z-index:1000;
            display:flex; align-items:center; justify-content:center;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white; padding: 18px 25px; border-radius: 10px;
            width: 90%; max-width: 480px; text-align: center;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            font-family: sans-serif;
        `;

        if (!hasEnoughAccuracy || !hasEnoughSpeed) {
            // --- INSUFFICIENT DATA VIEW ---
            modalContent.innerHTML = `
                <h3 style="color: #666; margin: 0 0 10px 0; font-size: 1.1rem;">Analysis in Progress</h3>
                <p style="color: #888; font-size: 0.85rem; line-height: 1.4; text-align: left; margin: 10px 0;">
                    We are still gathering data to identify your typing patterns accurately.<br><br>
                    <b>Current Progress:</b><br>
                    • Accuracy: ${drillState.attempts}/10 Drills ${hasEnoughAccuracy ? '✅' : ''}<br>
                    • Speed: ${drillState.attemptsClean}/5 <b>Clean</b> Finishes ${hasEnoughSpeed ? '✅' : ''}
                </p>
            `;
        } else {
            // --- DATA READY VIEW ---
            const highlightWord = (wordStr, indices, color) => {
                return wordStr.split('').map((char, idx) => {
                    if (indices.includes(idx)) {
                        return `<span style="color: ${color}; font-weight: bold; border: none; text-decoration: none;">${char}</span>`;
                    }
                    return char;
                }).join('');
            };

            const topAccuracy = [...stats.accuracyQueue].sort((a, b) => b.score - a.score).slice(0, 4);
            const topSpeed = [...stats.speedQueue].sort((a, b) => b.score - a.score).slice(0, 4);

            let html = `<h2 style="margin: 0 0 5px 0; color: #333; font-size: 1.25rem;">Practice Insights</h2>
                    <p style="font-size: 0.8rem; color: #666; margin-bottom: 15px; line-height: 1.3;">
                        <span style="color: #d9534f; font-weight: bold;">Red:</span> Mistake Density | 
                        <span style="color: #e67e22; font-weight: bold;">Orange:</span> Hesitation Density
                    </p>`;

            // Accuracy Section
            html += `<div style="text-align: left; margin-bottom: 15px;">
                    <h4 style="color: #d9534f; font-size: 0.95rem; margin: 0 0 8px 0; font-weight: 600;">Accuracy Hotspots</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">`;
            topAccuracy.forEach(item => {
                html += `<li style="margin-bottom: 6px; font-family: 'Courier New', monospace; font-size: 1.05rem; display: flex; justify-content: space-between; align-items: center;">
                        <span>${highlightWord(item.word, item.worstIndexes, '#d9534f')}</span>
                        <span style="color: #ccc; font-size: 0.7rem;">Score: ${item.score.toFixed(3)}</span>
                    </li>`;
            });
            html += `</ul></div>`;

            // Speed Section
            html += `<div style="text-align: left;">
                    <h4 style="color: #e67e22; font-size: 0.95rem; margin: 0 0 8px 0; font-weight: 600;">Speed Bottlenecks</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">`;
            topSpeed.forEach(item => {
                html += `<li style="margin-bottom: 6px; font-family: 'Courier New', monospace; font-size: 1.05rem; display: flex; justify-content: space-between; align-items: center;">
                        <span>${highlightWord(item.word, item.slowestIndexes, '#e67e22')}</span>
                        <span style="color: #ccc; font-size: 0.7rem;">Score: ${item.score.toFixed(3)}</span>
                    </li>`;
            });
            html += `</ul></div>`;

            modalContent.innerHTML = html;
        }

        // Back button
        const okButton = document.createElement("button");
        okButton.textContent = "Back to Practice";
        okButton.style.cssText = `
            margin-top: 15px; padding: 8px 25px; border:none; border-radius:6px;
            background:#444; color:white; cursor:pointer; font-weight: bold; font-size: 0.9rem; transition: background 0.2s;
        `;
        okButton.onmouseover = () => okButton.style.background = "#222";
        okButton.onmouseout = () => okButton.style.background = "#444";
        okButton.onclick = () => modal.remove();
        modalContent.appendChild(okButton);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    });


    // History events
    // 1 Method filter
    methodManual.addEventListener('change', handleMethodChange);
    methodHistory.addEventListener('change', handleMethodChange);

    filterToday.addEventListener('change', handleFilterChange);
    filterAll.addEventListener('change', handleFilterChange);
    filterSpaced.addEventListener('change', handleFilterChange);

});

// --- Edit mode toggle ---

function enterEditMode() {
    document.querySelector(".grid-container").classList.add("edit-mode");
    document.querySelector("#sequenceText").select();
}

function exitEditMode() {
    document.querySelector(".grid-container").classList.remove("edit-mode");
}


// --- History ---
function addToDrillHistory(drillText, wpmTarget) {
    const currentDrillHistoryRaw = localStorage.getItem(LOCAL_STORAGE_WORDS_KEY);
    const currentDrillHistory = currentDrillHistoryRaw ? JSON.parse(currentDrillHistoryRaw) : { accuracyQueue: [], speedQueue: [], historyQueue: [] };
    if (!currentDrillHistory.historyQueue) {
        currentDrillHistory.historyQueue = [];
    }
    const currentDrill = {
        "drillText": drillText,
        "wpmTarget": wpmTarget,
        "createdAt": Date.now(),
        "succeededTimes": 0,
        "nextReviewAt": null
    };
    const historyQueueLength = currentDrillHistory.historyQueue.length;
    if (historyQueueLength > 0) {
        const historyIdx = findHistoryDrillIndex(currentDrillHistory.historyQueue, historyQueueLength, drillText);
        if (historyIdx === null) {
            if (historyQueueLength > 100) {
                currentDrillHistory.historyQueue.shift();
            }
            currentDrillHistory.historyQueue.push(currentDrill);
            localStorage.setItem(LOCAL_STORAGE_WORDS_KEY, JSON.stringify(currentDrillHistory));
        }
    } else {
        currentDrillHistory.historyQueue.push(currentDrill);
        localStorage.setItem(LOCAL_STORAGE_WORDS_KEY, JSON.stringify(currentDrillHistory));
    }

}

function updateDrillHistoryWpmTarget(drillText, wpmTarget) {
    const drillHistoryRaw = localStorage.getItem(LOCAL_STORAGE_WORDS_KEY);
    const drillHistory = drillHistoryRaw ? JSON.parse(drillHistoryRaw) : { accuracyQueue: [], speedQueue: [], historyQueue: [] };
    const historyQueue = drillHistory.historyQueue;
    const historyQueueLength = historyQueue.length;
    if (historyQueueLength === 0) return;
    const historyIdx = findHistoryDrillIndex(historyQueue, historyQueueLength, drillText);
    if (historyIdx !== null) {
        historyQueue[historyIdx].wpmTarget = wpmTarget;
        drillHistory.historyQueue = historyQueue;
        localStorage.setItem(LOCAL_STORAGE_WORDS_KEY, JSON.stringify(drillHistory));
    }
}

function updateDrillHistoryNextReviewOnSucceed(drillText) {
    const drillHistoryRaw = localStorage.getItem(LOCAL_STORAGE_WORDS_KEY);
    const drillHistory = drillHistoryRaw ? JSON.parse(drillHistoryRaw) : { accuracyQueue: [], speedQueue: [], historyQueue: [] };
    const historyQueue = drillHistory.historyQueue;
    const historyQueueLength = historyQueue.length;
    if (historyQueueLength === 0) return;
    const historyIdx = findHistoryDrillIndex(historyQueue, historyQueueLength, drillText);
    if (historyIdx !== null) {
        // 1. Increment the success counter
        historyQueue[historyIdx].succeededTimes += 1;

        // 2. Calculate the delay
        // (4 days * hours * minutes * seconds * milliseconds)
        const daysInMs = 4 * 24 * 60 * 60 * 1000;
        const totalDelay = daysInMs * historyQueue[historyIdx].succeededTimes;

        // 3. Set the future timestamp
        historyQueue[historyIdx].nextReviewAt = Date.now() + totalDelay;

        // 4. Save back to storage
        localStorage.setItem(LOCAL_STORAGE_WORDS_KEY, JSON.stringify(drillHistory)); historyQueue[historyIdx].succeededTimes += 1;
    }
}

function findHistoryDrillIndex(historyQueue, historyQueueLength, drillText) {
    const lastIndex = historyQueueLength - 1;

    for (let i = lastIndex; i >= 0; i--) {
        if (historyQueue[i].drillText === drillText) {
            return i;
        }
    }

    return null;
}

// History drill
function resetSequenceForm() {
    // 1. Reset Master Toggle to Manual
    const methodManual = document.getElementById('methodManual');
    methodManual.checked = true;
    // 5. Trigger the UI layout update to hide/show correct rows
    handleFormOnTypeOfChange('manual');
};

// 1. Master Toggle: Manual vs History
function handleMethodChange() {
    if (document.getElementById('methodManual').checked) {
        handleFormOnTypeOfChange('manual');
    } else {
        handleFormOnTypeOfChange('filter');
    }
};

function handleFormOnTypeOfChange(methodType) {
    const filterRow = document.getElementById('historyFilterRow');
    const manualGroup = document.getElementById('manualInputGroup');
    const historyGroup = document.getElementById('historySelectGroup');
    const saveBtn = document.getElementById('drillTextChangeBtn');
    if (methodType === 'manual') {
        filterRow.classList.add('d-none');
        manualGroup.classList.remove('d-none');
        historyGroup.classList.add('d-none');
        if (saveBtn) saveBtn.classList.remove('keep-space-hidden');
        document.getElementById('sequenceText').required = true;
        const form = document.querySelector("form[name='sequence-form']");
        form.sequenceText.value = drillState.drillText;
        form.wpmTarget.value = drillState.wpmTarget;
    } else {
        filterRow.classList.remove('d-none');
        manualGroup.classList.add('d-none');
        historyGroup.classList.remove('d-none');
        // Hide Save button in History mode but keep its width in Column 1
        if (saveBtn) saveBtn.classList.add('keep-space-hidden');

        document.getElementById('sequenceText').required = false;
        // refreshHistorySelect2();
    }


}

function handleFilterChange(e) {
    console.log(`option filter ${e.target.value}`);
    refreshHistorySelect2(e.target.value);
};
function refreshHistorySelect2(filterType) {
    const stats = JSON.parse(localStorage.getItem(LOCAL_STORAGE_WORDS_KEY)) || { historyQueue: [] };
    const $select = $('#historySelect');

    $select.empty().append('<option value="">Search history...</option>');

    let filteredQueue = [...stats.historyQueue];
    const now = Date.now();

    // Apply specific filter logic
    if (filterType === 'today') {
        const todayStr = new Date().toDateString();
        filteredQueue = filteredQueue.filter(item =>
            new Date(item.createdAt).toDateString() === todayStr
        );
    } else if (filterType === 'spaced') {
        filteredQueue = filteredQueue.filter(item =>
            item.nextReviewAt !== null && item.nextReviewAt <= now
        );
    }
    // 'all' doesn't need a filter, it just uses the full queue

    // Append filtered items (reversed so newest is first)
    filteredQueue.reverse().forEach(drill => {
        const option = new Option(`${drill.drillText} (${drill.wpmTarget} WPM)`, drill.drillText, false, false);
        $(option).data('wpm', drill.wpmTarget);
        $select.append(option);
    });

    // Re-initialize Select2
    $select.select2({
        placeholder: "Search your drills...",
        allowClear: true
    });

    // Handle Selection
    // Inside your refreshHistorySelect2 function:
    $select.on('select2:select', function (e) {
        const data = e.params.data;
        // Get the WPM from the data-attribute we stored when creating the <option>
        const selectedWpm = $(e.params.data.element).data('wpm');

        // Fill the hidden WPM input from the manual group
        document.getElementById('wpmTarget').value = selectedWpm;

        // Trigger the submit automatically
        document.getElementById('sequence-form').requestSubmit();
    });
}



// --- Storage helpers ---

function loadFromStorage() {
    const raw = localStorage.getItem(LOCAL_STORAGE_DRILL_KEY);
    if (!localStorage.getItem(LOCAL_STORAGE_WORDS_KEY)) {
        localStorage.setItem(LOCAL_STORAGE_WORDS_KEY, JSON.stringify({ accuracyQueue: [], speedQueue: [] }));
    }
    if (raw === null) {
        return buildFreshState("sample text sequence, ", 60);
    }
    const state = JSON.parse(raw);
    // migrate old states missing new fields
    if (state.slowestWpmBest === undefined) state.slowestWpmBest = 0;
    if (state.attempts === undefined) state.attempts = 0;
    if (state.attemptsClean === undefined) state.attemptsClean = 0;
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
        attemptsClean: 0,
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
    charSpan.style.width = "15.7px";
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
        position: fixed; top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.5); display:flex;
        align-items:center; justify-content:center; z-index:1000;
    `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
        background:white; padding:28px; border-radius:8px;
        min-width:320px; display:flex; flex-direction:column; justify-content:center;
    `;

    const title = document.createElement("h5");
    title.textContent = "Settings";
    title.style.marginBottom = "10px";
    title.style.textAlign = "center";

    const formCheck1 = document.createElement("div");
    formCheck1.className = "form-check form-switch";
    formCheck1.style.cssText = `display:flex; align-items:center; gap:12px; margin-top:18px; margin-bottom:18px;`;

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

    const formCheck2 = document.createElement("div");
    formCheck2.className = "form-check form-switch";
    formCheck2.style.cssText = `display:flex; align-items:center; gap:12px; margin-top:18px; margin-bottom:18px;`;

    const spaceToggle = document.createElement("input");
    spaceToggle.className = "form-check-input";
    spaceToggle.type = "checkbox";
    spaceToggle.id = "space-toggle";
    spaceToggle.checked = drillState.showSpaceCharOnTopDrill === 1;
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
    buttonContainer.style.cssText = `margin-top:20px; display:flex; justify-content:space-between;`;

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

function startTimerOnFirstKey(e) {
    if (startTime === null && e.key !== "Enter" && e.key !== "Shift") startTime = Date.now();
}

// --- Typing logic ---

function handleTypingInput(e) {
    const typedText = e.target.value;
    const typeTextLength = typedText.length;
    if (typeTextLength === 0) return;

    const lastTypedIndex = typeTextLength - 1;
    const isLastCharOfDrill = typeTextLength === drillState.drillText.length;

    /* 1. WORD CAPTURE & ACCURACY TRIGGER */
    if (drillState.drillText[lastTypedIndex] !== ' ') {
        if (!wordStart) {
            wordStart = true;
            possibleWord = {
                charsSequence: [typedText[lastTypedIndex]],
                indexsSequence: [lastTypedIndex]
            };
        } else {
            possibleWord.charsSequence.push(typedText[lastTypedIndex]);
            possibleWord.indexsSequence.push(lastTypedIndex);
        }
    }

    if (wordStart && (drillState.drillText[lastTypedIndex] === ' ' || isLastCharOfDrill)) {
        updateGlobalAccuracyStats();
        currentDrillWords.push({ ...possibleWord });
        wordStart = false;
        possibleWord = {};
    }

    /* 2. VISUAL FEEDBACK & RAW DATA RECORDING */
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

    /* 3. FAILURE LOGIC (Freezing) */
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

    /* 4. END OF DRILL LOGIC */
    if (typeTextLength === drillState.drillText.length) {
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

        // --- CLEAN FINISH (SUCCESS) ---
        drillState.slowestWpmCharCount[slowestWpmLast.index] += 1;
        if (slowestWpmLast.wpm > drillState.slowestWpmBest) {
            drillState.slowestWpmBest = slowestWpmLast.wpm;
        }

        currentDrillWords.forEach(word => {
            updateGlobalSpeedStats(word);
        });

        const wpm = calculateWPM(typeTextLength, startTime, endTime);
        drillState.wpmLast = wpm;
        drillState.wpmHistory.shift();
        drillState.wpmHistory.push(wpm);
        drillState.lastTypedSequence = typedText;

        if (wpm > drillState.wpmBest) drillState.wpmBest = wpm;
        drillState.winStreak = wpm >= drillState.wpmTarget ? drillState.winStreak + 1 : 0;
        drillState.attempts += 1;
        drillState.attemptsClean += 1; // CHANGE: increment clean attempts counter
        drillState.lastDrillWasClean = true;
        drillState.slowestCharLastIndex = slowestWpmLast.index;

        saveToStorage(drillState);
        drillCompleted = true;

        e.target.readOnly = true;
        e.target.classList.add('frozen');
        addWpmStatsElements(drillState);
        keepCursorAtEnd(e.target);

        const successCount = drillState.wpmHistory.filter(w => w > 0).length;
        const rate = successCount * 10;
        if (drillState.winStreak >= 3 && drillState.attempts >= 10 && rate >= 50) {
            updateDrillHistoryNextReviewOnSucceed(drillState.drillText);
            setTimeout(() => showCongratulationsModal(
                `🎉 ${drillState.winStreak} wins in a row and ${rate}% success rate on the last 10 attempts. Keep it up!`,
                'OK'
            ), 50);
        }
    }
}

function updateGlobalAccuracyStats() {
    // gate: 10 total attempts
    if (drillState.attempts < 10) return;

    const { totalMistakes, maxMistakes } = getTotalMistakesAndMax();
    if (totalMistakes === 0) return;

    const startIndex = possibleWord.indexsSequence[0];
    const endIndex = possibleWord.indexsSequence[possibleWord.indexsSequence.length - 1];
    const wordKey = drillState.drillText.substring(startIndex, endIndex + 1).trim();

    const worstIdxs = [];
    possibleWord.indexsSequence.forEach((idx, i) => {
        if (drillState.charMistakesTotal[idx] === maxMistakes) {
            worstIdxs.push(i);
        }
    });

    const statsRaw = localStorage.getItem(LOCAL_STORAGE_WORDS_KEY);
    const stats = statsRaw ? JSON.parse(statsRaw) : { accuracyQueue: [], speedQueue: [] };

    const score = totalMistakes / (wordKey.length * Math.max(1, drillState.attempts));

    const wordData = {
        word: wordKey,
        score: parseFloat(score.toFixed(4)),
        worstIndexes: worstIdxs
    };

    const existingIndex = stats.accuracyQueue.findIndex(w => w.word === wordKey);
    if (existingIndex !== -1) {
        stats.accuracyQueue[existingIndex] = wordData;
    } else {
        stats.accuracyQueue.push(wordData);
        if (stats.accuracyQueue.length > 20) stats.accuracyQueue.shift();
    }

    localStorage.setItem(LOCAL_STORAGE_WORDS_KEY, JSON.stringify(stats));
}

function getTotalMistakesAndMax() {
    if (!possibleWord.indexsSequence) return { totalMistakes: 0, maxMistakes: 0 };

    let totalMistakes = 0;
    let maxMistakes = 0;
    const charMistakesTotal = drillState.charMistakesTotal;
    const wordIndexsSequence = possibleWord.indexsSequence;

    wordIndexsSequence.forEach(idx => {
        const mistakesAtChar = charMistakesTotal[idx] || 0;
        totalMistakes += mistakesAtChar;
        if (mistakesAtChar > maxMistakes) maxMistakes = mistakesAtChar;
    });

    return { totalMistakes, maxMistakes };
}

function updateGlobalSpeedStats(word) {
    // CHANGE: gate on attemptsClean instead of attempts
    if (drillState.attemptsClean < 5) return;

    const { totalSlows, maxSlows } = getTotalSlowsAndMaxForRange(word.indexsSequence);
    if (totalSlows === 0) return;

    const startIndex = word.indexsSequence[0];
    const endIndex = word.indexsSequence[word.indexsSequence.length - 1];
    const wordKey = drillState.drillText.substring(startIndex, endIndex + 1).trim();

    const slowestIdxs = [];
    word.indexsSequence.forEach((idx, i) => {
        if (drillState.slowestWpmCharCount[idx] === maxSlows) {
            slowestIdxs.push(i);
        }
    });

    const statsRaw = localStorage.getItem(LOCAL_STORAGE_WORDS_KEY);
    const stats = statsRaw ? JSON.parse(statsRaw) : { accuracyQueue: [], speedQueue: [] };

    // CHANGE: use attemptsClean as denominator — numerator only increments on clean drills
    const score = totalSlows / (wordKey.length * Math.max(1, drillState.attemptsClean));

    const wordData = {
        word: wordKey,
        score: parseFloat(score.toFixed(4)),
        slowestIndexes: slowestIdxs
    };

    const existingIndex = stats.speedQueue.findIndex(w => w.word === wordKey);
    if (existingIndex !== -1) {
        stats.speedQueue[existingIndex] = wordData;
    } else {
        stats.speedQueue.push(wordData);
        if (stats.speedQueue.length > 20) stats.speedQueue.shift();
    }

    localStorage.setItem(LOCAL_STORAGE_WORDS_KEY, JSON.stringify(stats));
}

function getTotalSlowsAndMaxForRange(wordIndexes) {
    let totalSlows = 0;
    let maxSlows = 0;

    wordIndexes.forEach(idx => {
        const slowsAtChar = drillState.slowestWpmCharCount[idx] || 0;
        totalSlows += slowsAtChar;
        if (slowsAtChar > maxSlows) maxSlows = slowsAtChar;
    });

    return { totalSlows, maxSlows };
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

    currentDrillWords = [];
    possibleWord = {};
    wordStart = false;

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
    const timeInSeconds = (endTime - startTime) * 0.001;
    const wpm = (typeTextLength / 5) * (60 / timeInSeconds);
    return Math.round(wpm);
}