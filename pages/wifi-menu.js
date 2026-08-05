import { input, InputAction } from "../shared/js/inputController.js";

const ACTIVE_CONTEXT = "wifi_active"

input.on(InputAction.CONFIRM, () => {
  input.pushContext(ACTIVE_CONTEXT);
});