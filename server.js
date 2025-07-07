const express = require("express");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static"); // <-- new

const app = express();
const PORT = process.env.PORT || 3000;

const STREAM_URL = "https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio010/hlspbaudio01064kbps.m3u8";

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

  const ffmpeg = spawn(ffmpegPath, [
    "-re",
    "-i", STREAM_URL,
    "-vn",
    "-acodec", "libmp3lame",
    "-f", "mp3",
    "-"
  ]);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", data => {
    console.error(`[FFmpeg stderr] ${data}`);
  });

  req.on("close", () => {
    console.log(`[${ip}] disconnected. Killing FFmpeg.`);
    ffmpeg.kill("SIGINT");
    activeStreams--;
    console.log(`Active streams: ${activeStreams}`);
  });

  setTimeout(() => {
    console.log(`[${ip}] timeout. Killing stream.`);
    res.end();
  }, 2 * 60 * 60 * 1000); // 2 hours
});

app.listen(PORT, () => {
  console.log(`🎧 Proxy running at http://localhost:${PORT}/stream`);
});
