const express = require("express");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// Your Akashvani stream source (HLS)
const STREAM_URL = "https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio010/hlspbaudio01064kbps.m3u8";

// Optional: limit connections
let activeStreams = 0;
const MAX_STREAMS = 5;

app.get("/stream", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (activeStreams >= MAX_STREAMS) {
    console.log(`[${ip}] rejected: too many streams`);
    return res.status(503).send("Server busy. Try again later.");
  }

  activeStreams++;
  console.log(`[${ip}] connected. Active streams: ${activeStreams}`);

  res.set({
    "Content-Type": "audio/mpeg",
    "Transfer-Encoding": "chunked",
    "Connection": "keep-alive"
  });

  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-i", STREAM_URL,
    "-vn",
    "-acodec", "libmp3lame",
    "-f", "mp3",
    "-"
  ]);

  // Pipe FFmpeg output to client
  ffmpeg.stdout.pipe(res);

  // Log stderr (for debugging)
  ffmpeg.stderr.on("data", data => {
    console.error(`[FFmpeg stderr] ${data}`);
  });

  // Kill on disconnect
  req.on("close", () => {
    console.log(`[${ip}] disconnected. Killing FFmpeg.`);
    ffmpeg.kill("SIGINT");
    activeStreams--;
    console.log(`Active streams: ${activeStreams}`);
  });

  // Optional timeout for long-lived connections
  setTimeout(() => {
    console.log(`[${ip}] auto-timeout. Killing stream.`);
    res.end(); // triggers .on("close")
  }, 2 * 60 * 60 * 1000); // 2 hours
});

app.listen(PORT, () => {
  console.log(`🎧 Proxy running at http://localhost:${PORT}/stream`);
});
