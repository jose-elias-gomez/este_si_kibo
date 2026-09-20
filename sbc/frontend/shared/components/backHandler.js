import { input, InputAction } from "../js/inputController.js";

export function setupBackHandler({ context, onBack }) {
    input.pushContext(context);

    input.on(
        InputAction.BACK,
        () => {
            console.log(`[${context}] BACK`);

            onBack();
        },
        context
    );

    return () => {
        input.popContext();
    };
}
