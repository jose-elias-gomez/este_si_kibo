import { onPacket, PACKET_ID } from "../../../shared/js/api/client.js";
import { addReplyFromNow, addTranscribeFromNow } from "./inactive.js";
import { input } from "../../../shared/js/inputController.js";

const processingDialog = document.getElementById("processing-dialog");

onPacket(PACKET_ID.ASSISTANT_RESPONSE, (data) => finish(data.reply, data.transcribe));

let timeout;
export function waitForProcess() {
    input.pushContext("processing-audio");
    processingDialog.showModal();

    timeout = setTimeout(() => finish("Parece no haber conexión con el servidor"), 10000);
}

function finish(reply = null, transcribe = null) {
    input.popContext();
    processingDialog.close();

    clearTimeout(timeout);

    if (transcribe != null) {
        addTranscribeFromNow(transcribe);
    }

    if (reply != null) {
        addReplyFromNow(reply);
    }
}
