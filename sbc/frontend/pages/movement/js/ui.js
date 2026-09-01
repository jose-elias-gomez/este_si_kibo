import { selectPart, runMotor, stopMotor, playAnimation } from "./movement.js";
import { MotorDirection, NODE_LABELS, PARTS_CONFIG } from "./partsConfig.js";
import { setPartAngle, getPivotAngle } from "./movement.js";
import { input, InputAction } from "../../../shared/js/inputController.js";

let partButtonIndex = 2;
let animationButtonIndex = 0;

const movementPanel = document.getElementById("movement-panel");
const animationPanel = document.getElementById("animations-panel");

const partButtons = movementPanel.querySelectorAll(".btn-part");
const animationButtons = animationPanel.querySelectorAll(".btn-part");

const manualSlider = document.getElementById("manual-slider");
const motorRun = document.getElementById("motor-run");
const motorWidget = document.querySelector(".motor-widget");
const motorTimerValue = document.querySelector(".motor-timer-value");

let motorTimerInterval = null;
let motorElapsedSeconds = 0;

let currentMotorPart = null;

function startMotorTimer() {
    motorElapsedSeconds = 0;
    motorTimerValue.textContent = "0s";
    motorTimerInterval = setInterval(() => {
        motorElapsedSeconds++;
        motorTimerValue.textContent = motorElapsedSeconds + "s";
    }, 1000);
}

function stopMotorTimer() {
    clearInterval(motorTimerInterval);
    motorTimerInterval = null;
}

function setMotorRunning(isRunning, partName) {
    motorRun.classList.toggle("is-paused", isRunning);
    let direction;
    if (partName === "MotorLeft") {
        direction = motorWidget.classList.contains("align-right") ? MotorDirection.FORWARD : MotorDirection.BACKWARD;
    } else {
        direction = motorWidget.classList.contains("align-right") ? MotorDirection.BACKWARD : MotorDirection.FORWARD;
    }
    if (isRunning) {
        runMotor(partName, direction);
        startMotorTimer();
    } else {
        stopMotor(partName, direction);
        stopMotorTimer();
    }
}

partButtons[partButtonIndex].classList.add('active');

function updateFocusedButton(array, prevIndex, newIndex) {
    if (prevIndex !== undefined) {
        array[prevIndex].classList.remove('hovered');
    }
    
    const currentBtn = array[newIndex];
    currentBtn.classList.add('hovered');
    
    currentBtn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
    });
}

input.on(InputAction.DOWN, () => {
    animationPanel.open();
    updateFocusedButton(animationButtons, undefined, animationButtonIndex);

    input.on(InputAction.LEFT, () => {
        if (animationButtonIndex > 0) {
            updateFocusedButton(animationButtons, animationButtonIndex, --animationButtonIndex);
        }
    }, animationPanel.context);

    input.on(InputAction.RIGHT, () => {
        if (animationButtonIndex < animationButtons.length - 1) {
            updateFocusedButton(animationButtons, animationButtonIndex, ++animationButtonIndex);
        }
    }, animationPanel.context);
    
    input.on(InputAction.CONFIRM, () => {
        const btn = animationButtons[animationButtonIndex];
        const type = btn.getAttribute("data-animation");
        playAnimation(type);
        animationPanel.close();

    }, animationPanel.context);
});

input.on(InputAction.UP, () => {
    movementPanel.open();
    updateFocusedButton(partButtons, undefined, partButtonIndex);

    input.on(InputAction.LEFT, () => {
        if (partButtonIndex > 0) {
            updateFocusedButton(partButtons, partButtonIndex, --partButtonIndex);
        }
    }, movementPanel.context);

    input.on(InputAction.RIGHT, () => {
        if (partButtonIndex < partButtons.length - 1) {
            updateFocusedButton(partButtons, partButtonIndex, ++partButtonIndex);
        }
    }, movementPanel.context);

    input.on(InputAction.CONFIRM, () => {
        const btn = partButtons[partButtonIndex];
        const view = btn.getAttribute('data-view');
        const partName = btn.getAttribute('data-node');

        partButtons.forEach(b => b.classList.remove("active"));

        btn.classList.add("active");
        selectPart(partName, view);
        movementPanel.close();

        if (partName === "LeftWheel" || partName == "RightWheel") {
            currentMotorPart = partName;

            motorWidget.classList.add("visible");
            input.pushContext("motor-run");
            input.on(InputAction.BACK, () => {
                motorWidget.classList.remove("visible");
                setMotorRunning(false, currentMotorPart);
                currentMotorPart = null;
                input.popContext();
            }, "motor-run");

            input.on(InputAction.CONFIRM, () => {
                setMotorRunning(!motorRun.classList.contains('is-paused'), currentMotorPart);
            }, "motor-run");

            input.on(InputAction.LEFT, () => {
                motorWidget.classList.remove("align-right");
                motorWidget.classList.add("align-left");
            }, "motor-run");

            input.on(InputAction.RIGHT, () => {
                motorWidget.classList.remove("align-left");
                motorWidget.classList.add("align-right");
            }, "motor-run");
            return;
        }

        // 1. Mostrar con transición usando la clase
        input.pushContext("manual-slider");
        manualSlider.classList.add("visible");
        manualSlider.setTitle(NODE_LABELS[partName]);

        const part = PARTS_CONFIG[partName];
        manualSlider.setMin(part.min);
        manualSlider.setMax(part.max);
        manualSlider.value = getPivotAngle(partName);

        input.on(InputAction.LEFT, () => {
            manualSlider.step(-1);
            setPartAngle(manualSlider.value);
        }, "manual-slider");

        input.on(InputAction.RIGHT, () => {
            manualSlider.step(1);
            setPartAngle(manualSlider.value);
        }, "manual-slider");

        input.on(InputAction.BACK, () => {
            // 2. Ocultar con transición removiendo la clase
            manualSlider.classList.remove("visible");
            input.popContext();
        }, "manual-slider");
    }, movementPanel.context);
});