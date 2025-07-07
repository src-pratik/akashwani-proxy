// server.js
const express = require("express");
const { spawn } = require("child_process");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

const STREAM_URL = "https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio010/hlspbaudio01064kbps.m3u8";
let activeStreams = 0;
const MAX_STREAMS = 5;

app.get("/stream", (req, res) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(`[${clientIp}] connection attempt.`);

  if (activeStreams >= MAX_STREAMS) {
    console.warn(`[${clientIp}] rejected: too many streams (${activeStreams}).`);
    return res.status(503).send("Server busy. Try again later.");
  }

  activeStreams++;
  console.log(`[${clientIp}] connected. Active streams: ${activeStreams}`);

  res.set({
    "Content-Type": "audio/mpeg",
    "Transfer-Encoding": "chunked",
    "Connection": "keep-alive"
  });

  const ffmpeg = spawn("ffmpeg", [
    "-user_agent", "Mozilla/5.0 (compatible; AkashvaniProxy/1.0)",
    "-re",
    "-i", STREAM_URL,
    "-vn",
    "-acodec", "libmp3lame",
    "-f", "mp3",
    "-"
  ]);

  console.log(`[${clientIp}] FFmpeg process started (PID: ${ffmpeg.pid})`);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", data => {
    console.error(`[FFmpeg stderr][${clientIp}] ${data.toString().trim()}`);
  });

  ffmpeg.on("exit", (code, signal) => {
    console.warn(`[${clientIp}] FFmpeg exited. Code: ${code}, Signal: ${signal}`);
  });

  req.on("close", () => {
    console.log(`[${clientIp}] disconnected. Terminating FFmpeg (PID: ${ffmpeg.pid})`);
    ffmpeg.kill("SIGINT");
    activeStreams--;
    console.log(`Active streams: ${activeStreams}`);
  });

  // Optional 2-hour timeout
  setTimeout(() => {
    console.log(`[${clientIp}] timeout reached. Terminating stream.`);
    res.end();
  }, 2 * 60 * 60 * 1000);
});

app.listen(PORT, () => {
  console.log(`\n🎧 Akashvani proxy server started on http://${os.hostname()}:${PORT}/stream`);
  console.log(`FFmpeg stream source: ${STREAM_URL}`);
  console.log("Max active streams:", MAX_STREAMS);
});
