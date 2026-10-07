export class MediaController {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.objectUrl = null;
    this.mode = "standby";
  }

  get supportsCamera() {
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async startCamera(constraints = {
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
  }) {
    if (!this.supportsCamera) {
      throw new Error("Camera API is unavailable in this browser.");
    }
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    await this.video.play();
    this.mode = "camera";
    return this.video;
  }

  async loadFile(file) {
    if (!(file instanceof File) || !file.type.startsWith("video/")) {
      throw new TypeError("A video file is required.");
    }
    this.stop();
    this.objectUrl = URL.createObjectURL(file);
    this.video.srcObject = null;
    this.video.src = this.objectUrl;
    await this.video.play();
    this.mode = "file";
    return this.video;
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.video.pause();
    this.video.srcObject = null;
    this.video.removeAttribute("src");
    this.video.load();
    this.mode = "standby";
  }
}
