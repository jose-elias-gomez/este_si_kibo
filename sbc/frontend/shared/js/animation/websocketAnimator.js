import { PACKET_ID, sendPacket} from "../api/client.js"

const partAngles = Map();

const instance = new WebsocketAnimator();
export default instance;

sendPacket({"id": PACKET_ID.GET_PARTS}, true).then((parts) => {
  for (part in parts) {
    this.partAngles.set(part.name, part.value);
  }
});

class WebsocketAnimator {
  setAngleForPart(part, angle) {
    const partAngle = this.partAngles.get(part);
    if (partAngle == undefined) {
      return;
    }

    this.partAngles.set(part, angle);
    sendPacket({"id": PACKET_ID.MOVE_PART, "angle": angle});
  }

  getAngleForPart(part) {
    return partAngles.get(part) ?? 0;
  }
}
