document.addEventListener("DOMContentLoaded", function () {
  // 定義計時器資料（初始為空）
  let timerData = [];
  let validTimerData = []; // 儲存從 JSON 讀取的有效資料

  const TIMER_IDS_STORAGE_KEY = "savedTimerIds";
  const TIMER_STATES_STORAGE_KEY = "timerStates";
  const SOUND_ENABLED_STORAGE_KEY = "soundEnabled";
  const soundEnabled = document.getElementById("soundEnabled");
  const timerRow = document.getElementById("timerRow");
  const copyTooltip = document.getElementById("copyTooltip");
  const idInput = document.getElementById("idInput");
  const generateBtn = document.getElementById("generateBtn");
  const AUDIO_URL = "./assets/sounds/hotpot.mp3"; // 預設音效路徑

  // 新增 Dual Listbox 相關元素
  const sourceList = document.getElementById("sourceList");
  const targetList = document.getElementById("targetList");

  // 添加設定區域的初始化
  initSettingsToggle();

  let settingMode = false;
  let audioElement = null; // 用於存放音效元素

  // 載入 JSON 資料並初始化 source list
  fetch("./config/data.json")
    .then((response) => response.json())
    .then((data) => {
      validTimerData = data.timers;
      // 填充源清單
      validTimerData.forEach((timer) => {
        const option = new Option(`${timer.label} (${timer.id})`, timer.id);
        sourceList.add(option);
      });

      // 在 JSON 資料載入完成後,載入儲存的 timer ids
      loadSavedTimerIds();
    })
    .catch((error) => {
      console.error("Error loading timer data:", error);
    });


    // 讀取儲存的音效設定
    const savedSoundEnabled = localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
    if (savedSoundEnabled !== null) {
      // 明確地將字串轉換為布林值
      soundEnabled.checked = savedSoundEnabled === "true";
      // 只有在確實是勾選狀態時才初始化音效
      if (soundEnabled.checked) {
        initAudio();
      }
    }

  function isValidTimer(value) {
    return validTimerData.find((timer) => timer.id === value);
  }

  function isExistingTimer(value) {
    return timerData.find((timer) => timer.id === value);
  }

  // 儲存 timer ids 到 localStorage
  function saveTimerIds() {
    const options = Array.from(targetList.options);
    const ids = options.map((option) => option.value);
    localStorage.setItem(TIMER_IDS_STORAGE_KEY, JSON.stringify(ids));
  }

  // 從 localStorage 讀取 timer ids
  function loadSavedTimerIds() {
    const savedIds = localStorage.getItem(TIMER_IDS_STORAGE_KEY);
    if (savedIds) {
      try {
        const ids = JSON.parse(savedIds);
        // 將儲存的 ids 設定到 textarea
        idInput.value = ids.join("\n");
        // 觸發生成按鈕點擊來重建計時器
        generateBtn.click();
      } catch (e) {
        console.error("Error parsing saved timer ids:", e);
      }
    }
  }

  // 新增儲存計時器狀態的函數
  function saveTimerStates() {
    const states = Array.from(document.querySelectorAll(".timer-container"))
      .map((container) => {
        const id = container.dataset.id;
        const remainingTime = parseInt(container.dataset.remainingTime) || 0;
        if (remainingTime > 0) {
          return {
            id,
            remainingTime,
            timestamp: Date.now(),
          };
        }
        return null;
      })
      .filter((state) => state !== null);

    localStorage.setItem(TIMER_STATES_STORAGE_KEY, JSON.stringify(states));
  }

  // 新增載入計時器狀態的函數
  function loadTimerStates() {
    const savedStates = localStorage.getItem(TIMER_STATES_STORAGE_KEY);
    if (!savedStates) return null;

    try {
      const states = JSON.parse(savedStates);
      const currentTime = Date.now();

      return states.map((state) => {
        const elapsedSeconds = Math.floor(
          (currentTime - state.timestamp) / 1000
        );
        const remainingTime = Math.max(0, state.remainingTime - elapsedSeconds);

        return {
          id: state.id,
          remainingTime: remainingTime,
        };
      });
    } catch (e) {
      console.error("Error parsing timer states:", e);
      return null;
    }
  }

  function createTimerElement(timer, order) {
    const timerWrapper = document.createElement("div");
    timerWrapper.className = "timer-wrapper";
    timerWrapper.style.order = order.toString();

    timerWrapper.innerHTML = `
                <div class="timer-container" data-remaining-time="0" data-id="${
                  timer.id
                }">
                    <div class="color-block">
                        ${
                          timer.imageUrl
                            ? `<img src="${timer.imageUrl}" alt="${timer.label}" class="timer-image">`
                            : ""
                        }
                    </div>
                    <input type="number" class="timer-input" placeholder="分鐘" min="1" max="60">
                    <div class="timer-display"></div>
                </div>
                <div class="timer-label">${timer.label}</div>
            `;

    return timerWrapper;
  }

  function getMaxOrder() {
    const existingTimers = document.querySelectorAll(".timer-wrapper");
    return Math.max(
      ...Array.from(existingTimers).map(
        (wrapper) => parseInt(wrapper.style.order) || 0
      ),
      -1
    );
  }

  function moveOptionToTarget(sourceOption, targetList) {
    const newOption = new Option(sourceOption.text, sourceOption.value);
    targetList.add(newOption);
    sourceOption.remove();
    // 更新 textarea
    updateTextarea();
  }

  sourceList.addEventListener("dblclick", function (e) {
    const option = e.target;
    // 如果點擊的不是 option 元素，直接返回
    if (option.tagName !== "OPTION") return;
    // 如果找不到對應的計時器資料或計時器已經存在，直接返回
    const matchedTimer = isValidTimer(option.value);
    if (!matchedTimer || isExistingTimer(option.value)) return;

    // 移動選項從來源列表到目標列表
    moveOptionToTarget(e.target, targetList);
    // 新增計時器
    addNewTimer(matchedTimer);
    // 重新綁定事件
    bindEvents();
  });

  // 抽取新增計時器的邏輯
  function addNewTimer(timer) {
    const maxOrder = getMaxOrder();
    const timerWrapper = createTimerElement(timer, maxOrder + 1);
    timerRow.appendChild(timerWrapper);

    timerData.push({
      id: timer.id,
      imageUrl: timer.imageUrl,
      label: timer.label,
      isRunning: false,
    });
  }

  // dual listbox 雙擊事件處理 - 從右側移動回左側
  targetList.addEventListener("dblclick", function (e) {
    if (e.target.tagName !== "OPTION") return;

    const option = e.target;
    moveOptionToSource(option);
    removeTimer(option.value);
  });

  function moveOptionToSource(option) {
    const newOption = new Option(option.text, option.value);
    sourceList.insertBefore(newOption, sourceList.firstChild);
    targetList.remove(option.index);
    // 更新 textarea
    updateTextarea();
  }

  function removeTimer(timerId) {
    timerData = timerData.filter((timer) => timer.id !== timerId);

    const timerWrapper = document.querySelector(
      `.timer-wrapper .timer-container[data-id="${timerId}"]`
    )?.parentElement;

    if (!timerWrapper) return;

    clearExistingTimer(timerWrapper);
    timerWrapper.remove();
  }

  function clearExistingTimer(wrapper) {
    const container = wrapper.querySelector(".timer-container");
    const intervalId = container.dataset.intervalId;
    if (intervalId) {
      clearInterval(parseInt(intervalId));
    }
  }

  // 生成按鈕點擊事件
  generateBtn.addEventListener("click", function () {
    const runningStates = captureRunningStates();
    const inputs = parseInputs();
    processInputs(inputs);
    createTimers(runningStates);
  });

  // 捕獲當前運行中的計時器狀態
  function captureRunningStates() {
    return Array.from(document.querySelectorAll(".timer-container")).reduce(
      (acc, container) => {
        const id = container.dataset.id;
        const remainingTime = container.dataset.remainingTime;
        const display = container.querySelector(".timer-display");

        if (display.textContent && parseInt(remainingTime) > 0) {
          acc[id] = {
            remainingTime,
            displayText: display.textContent,
            intervalId: container.dataset.intervalId,
          };
        }
        return acc;
      },
      {}
    );
  }

  // 更新 Textarea
  function updateTextarea() {
    const options = Array.from(targetList.options);
    const ids = options.map((option) => option.value);
    idInput.value = ids.join("\n");
    // 儲存到 localStorage
    saveTimerIds();
  }

  // 解析輸入值
  function parseInputs() {
    return idInput.value
      .split("\n")
      .map((input) => input.trim())
      .filter((input) => input !== "");
  }

  // 處理輸入並更新計時器數據
  function processInputs(inputs) {
    let hasChanges = false;

    inputs.forEach((input) => {
      const matchedTimer = validTimerData.find(
        (timer) =>
          timer.id.toLowerCase() === input.trim().toLowerCase() ||
          timer.label.toLowerCase() === input.trim().toLowerCase()
      );

      if (matchedTimer && !isExistingTimer(matchedTimer.id)) {
        // 使用已存在的 timerData.push 邏輯
        timerData.push({
          id: matchedTimer.id,
          imageUrl: matchedTimer.imageUrl,
          label: matchedTimer.label,
          isRunning: false,
        });

        // 處理 dual listbox 的移動
        const sourceOption = sourceList.querySelector(
          `option[value="${matchedTimer.id}"]`
        );
        if (sourceOption) {
          // 使用已存在的 moveOptionToTarget 函數
          moveOptionToTarget(sourceOption, targetList);
        }
      }
    });

    // 如果有變更才更新 textarea
    if (hasChanges) {
      updateTextarea();
    }
  }

  // 創建計時器 UI - 優化版本
  function createTimers(runningStates) {
    const existingTimers = document.querySelectorAll(".timer-wrapper");
    const existingTimerIds = new Set(
      Array.from(existingTimers).map(
        (wrapper) => wrapper.querySelector(".timer-container").dataset.id
      )
    );

    let maxOrder = getMaxOrder();
    const fragment = document.createDocumentFragment();

    // 載入儲存的計時器狀態
    const savedStates = loadTimerStates();
    const stateMap = savedStates
      ? Object.fromEntries(savedStates.map((state) => [state.id, state]))
      : {};

    timerData.forEach((timer) => {
      if (!existingTimerIds.has(timer.id)) {
        maxOrder++;
        const timerWrapper = createTimerElement(timer, maxOrder);
        const container = timerWrapper.querySelector(".timer-container");
        const input = container.querySelector(".timer-input");
        const display = container.querySelector(".timer-display");

        // 檢查是否有儲存的狀態
        const savedState = stateMap[timer.id];
        if (savedState && savedState.remainingTime > 0) {
          container.classList.add("timing");
          container.dataset.remainingTime = savedState.remainingTime;
          input.style.display = "none";
          display.style.display = "block";

          // 開始倒數
          startTimer(container, savedState.remainingTime);
        }

        fragment.appendChild(timerWrapper);
      }
    });

    timerRow.appendChild(fragment);
    bindEvents();

    // 新增：在所有計時器載入後進行排序
    requestAnimationFrame(() => {
      updateOrder();
    });
  }

  // 音效相關函數
  function initAudio() {
    if (!audioElement) {
      audioElement = new Audio(AUDIO_URL);
      // 預先載入音效
      audioElement.load();
    }
  }

  function playSound() {
    if (!soundEnabled.checked) return;

    if (audioElement) {
      // 重置音效播放位置
      audioElement.currentTime = 0;
      // 播放音效
      audioElement.play().catch((error) => {
        console.error("Error playing sound:", error);
      });
    }
  }

  function bindEvents() {
    const containers = document.querySelectorAll(".timer-container");

    containers.forEach((container) => {
      const input = container.querySelector(".timer-input");

      // 點擊事件處理
      timerRow.addEventListener("click", (e) => {
        const container = e.target.closest(".timer-container");
        if (!container) return;

        if (!settingMode) {
          const input = container.querySelector(".timer-input");
          input.style.display = "block";
          input.focus();
        }
      });

      // blur 事件處理
      input.addEventListener("blur", function () {
        const minutes = parseInt(input.value);
        if (minutes && minutes > 0 && minutes <= 60) {
          startTimer(container, minutes * 60);
          input.style.display = "none";
          input.value = "";
          container.classList.add("timing");
        } else {
          input.style.display = "none";
          input.value = "";
        }
      });

      // 右鍵複製功能
      timerRow.addEventListener("contextmenu", (e) => {
        const container = e.target.closest(".timer-container");
        if (!container) return;

        e.preventDefault();
        const id = container.getAttribute("data-id");
        navigator.clipboard.writeText(id).then(() => {
          copyTooltip.style.opacity = "1";
          copyTooltip.style.left = e.pageX + 10 + "px";
          copyTooltip.style.top = e.pageY + 10 + "px";
          setTimeout(() => {
            copyTooltip.style.opacity = "0";
          }, 1500);
        });
      });

      // 輸入處理
      input.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          const minutes = parseInt(input.value);
          if (minutes > 0 && minutes <= 60) {
            startTimer(container, minutes * 60);
            input.style.display = "none";
            input.value = "";
            container.classList.add("timing");
          }
        }
      });
    });
  }

  function startTimer(container, seconds) {
    clearExistingInterval(container);
    initializeTimer(container, seconds);
    return startCountdown(container, seconds);
  }

  function clearExistingInterval(container) {
    const oldIntervalId = container.dataset.intervalId;
    if (oldIntervalId) {
      clearInterval(parseInt(oldIntervalId));
      container.dataset.intervalId = "";
    }
  }

  function initializeTimer(container, seconds) {
    const display = container.querySelector(".timer-display");
    container.setAttribute("data-remaining-time", seconds);
    display.style.display = "block";
  }

  function startCountdown(container, seconds) {
    let remainingTime = seconds;
    const display = container.querySelector(".timer-display");

    function updateDisplay() {
      requestAnimationFrame(() => {
        const minutes = Math.floor(remainingTime / 60);
        const secs = remainingTime % 60;
        display.textContent = `${minutes}:${secs.toString().padStart(2, "0")}`;
        container.setAttribute("data-remaining-time", remainingTime);
        // 每次更新時儲存狀態
        saveTimerStates();
      });
    }

    const countdown = setInterval(() => {
      if (remainingTime <= 0) {
        finishCountdown(container, countdown);
        return;
      }

      // 在這裡加入檢查30秒的邏輯
      if (remainingTime === 30) {
        playSound();
      }

      remainingTime--;
      updateDisplay();
    }, 1000);

    container.dataset.intervalId = countdown;
    updateDisplay();
    updateOrder();

    return countdown;
  }

  function finishCountdown(container, intervalId) {
    clearInterval(intervalId);
    const display = container.querySelector(".timer-display");
    display.style.display = "none";
    container.classList.remove("timing");
    container.dataset.intervalId = "";
    container.dataset.remainingTime = "0";
    saveTimerStates(); // 更新儲存的狀態
    updateOrder();
  }

  // 更新排序
  function updateOrder() {
    const wrappers = Array.from(document.querySelectorAll(".timer-wrapper"));

    // 修改排序邏輯
    const sortedWrappers = wrappers.sort((a, b) => {
      const containerA = a.querySelector(".timer-container");
      const containerB = b.querySelector(".timer-container");
      const timeA = parseInt(containerA.dataset.remainingTime) || 0;
      const timeB = parseInt(containerB.dataset.remainingTime) || 0;

      // 如果兩個都沒有倒數時間，保持原有順序
      if (timeA === 0 && timeB === 0) {
        return 0;
      }

      // 有倒數時間的排在前面，倒數時間較小的更前面
      if (timeA === 0) return 1;
      if (timeB === 0) return -1;
      return timeA - timeB;
    });

    // 使用 DocumentFragment 來減少重繪
    const fragment = document.createDocumentFragment();
    sortedWrappers.forEach((wrapper, index) => {
      wrapper.style.order = index;
      fragment.appendChild(wrapper);
    });

    timerRow.appendChild(fragment);
  }

  // 音效checkbox事件
  soundEnabled.addEventListener("change", function () {
    // 儲存狀態到 localStorage
    localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, this.checked);

    if (this.checked) {
      initAudio();
    }
  });
});

function initSettingsToggle() {
  const toggleBtn = document.getElementById("toggleSettings");
  const settingsContent = document.querySelector(".settings-content");
  const arrow = toggleBtn.querySelector(".arrow");

  // 儲存初始高度
  let originalHeight = settingsContent.scrollHeight;

  // 設定初始狀態
  settingsContent.style.maxHeight = originalHeight + "px";

  // 監聽視窗大小改變
  window.addEventListener("resize", function () {
    if (!settingsContent.classList.contains("collapsed")) {
      // 只在展開狀態下更新高度
      settingsContent.style.maxHeight = "none"; // 暫時移除限制以獲得真實高度
      originalHeight = settingsContent.scrollHeight;
      settingsContent.style.maxHeight = originalHeight + "px";
    }
  });

  toggleBtn.addEventListener("click", function () {
    settingsContent.classList.toggle("collapsed");

    if (settingsContent.classList.contains("collapsed")) {
      settingsContent.style.maxHeight = 0;
      arrow.style.transform = "rotate(-90deg)";
    } else {
      settingsContent.style.maxHeight = originalHeight + "px";
      arrow.style.transform = "rotate(0deg)";
    }
  });
}
